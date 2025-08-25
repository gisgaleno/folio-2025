import { abs, atan, float, Fn, If, max, min, PI, positionGeometry, positionWorld, uniform, vec2, vec3, vec4 } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { clamp } from 'three/src/math/MathUtils.js'
import { smallestAngle } from './utilities/maths.js'

export class Nipple
{
    constructor()
    {
        this.game = Game.getInstance()
        this.position = new THREE.Vector3()
        this.raycaster = new THREE.Raycaster()

        this.active = false
        this.rotation = 0
        this.progress = 0
        this.smallestRotation = 0
        this.targetRotation = 0
        this.forward = true

        this.setMeshes()
        this.setPointerTesting()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 1)
        
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🕹️ Touch Joystick',
                expanded: true,
            })
            this.debugPanel.addBinding(this.uniforms.progress, 'value', { label: 'progress', min: 0, max: 1 })
            this.debugPanel.addBinding(this.uniforms.forward, 'value', { label: 'forward', min: 0, max: 1, step: 1 })
        }
    }

    setMeshes()
    {
        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        const geometry = new THREE.PlaneGeometry(1, 1)
        geometry.rotateX(- Math.PI * 0.5)

        this.uniforms = {}
        this.uniforms.position = uniform(vec3())
        this.uniforms.progress = uniform(1)
        this.uniforms.forward = uniform(1)
        this.uniforms.progressStartAngle = uniform(0)
        this.uniforms.progressEndAngle = uniform(0)
        this.uniforms.colorMultiplier = uniform(1)
        
        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })

        this.edgesThickness = 0.1
        this.outlineThickness = 0.2
        this.progressRadiusLow = 2
        this.progressRadiusHigh = 4.5
        this.forwardAmplitude = Math.PI * 1.5

        material.outputNode = Fn(() =>
        {
            const radialCoord = vec2(positionGeometry.xz).mul(10)
            const radialAngle = atan(radialCoord.y, radialCoord.x)

            // Angle
            const directionAngleSDF = abs(radialAngle).sub(this.forwardAmplitude * 0.5).toVar()
            
            If(this.uniforms.forward.lessThan(0.5), () =>
            {
                directionAngleSDF.assign(directionAngleSDF.negate())
            })
            const directionAngle = directionAngleSDF.step(0)

            // Edges
            const innerEdgeSDF = abs(radialCoord.length().sub(this.progressRadiusLow)).toVar()
            const outerEdgeSDF = abs(radialCoord.length().sub(this.progressRadiusHigh)).toVar()

            const innerEdgeFill = innerEdgeSDF.step(this.edgesThickness / 2).toVar()
            const innerEdgeOutline = innerEdgeSDF.step(this.outlineThickness / 2).toVar()

            const outerEdgeFill = outerEdgeSDF.step(this.edgesThickness / 2).mul(directionAngle).toVar()
            const outerEdgeOutline = outerEdgeSDF.step(this.outlineThickness / 2).toVar()

            const edgesFill = max(innerEdgeFill, outerEdgeFill)
            const edgesOutline = max(innerEdgeOutline, outerEdgeOutline)

            // Progress
            const progressSDF = radialCoord.length().sub(this.progressRadiusLow).sub(this.uniforms.progress.mul(this.progressRadiusHigh - this.progressRadiusLow - this.outlineThickness / 2)).toVar() // Distance between edges minus outlines

            const progressLowSDF = radialCoord.length().sub(this.progressRadiusLow + this.outlineThickness / 2).negate()
            progressSDF.assign(max(progressSDF, progressLowSDF))

            const progressFill = progressSDF.step(0).toVar()

            const inAngle = float(0).toVar()
            If(radialAngle.greaterThan(this.uniforms.progressStartAngle).and(radialAngle.lessThan(this.uniforms.progressEndAngle)), () =>
            {
                inAngle.assign(1)
            })
            progressFill.assign(progressFill.mul(inAngle))

            const progressOutline = progressSDF.step(this.outlineThickness / 4).mul(directionAngle)

            // Final fill and outline
            const outline = max(edgesOutline, progressOutline)
            const fill = max(edgesFill, progressFill).toVar()

            // Discard
            outline.lessThan(0.00001).discard()

            // Alpha
            const alpha = outline.mul(0.35).add(fill.mul(0.75))

            return vec4(vec3(fill).mul(this.uniforms.colorMultiplier), alpha)
        })()
        
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.visible = true

        this.mesh.scale.setScalar(10)
        // this.mesh.position.y = 0.75

        this.group.add(this.mesh)
    }

    setCoordinates(x, y, z, angle)
    {
        const clampedY = Math.max(0.1, y - 0.25)
        this.position.set(x, clampedY, z)
        this.group.position.copy(this.position)
        this.uniforms.position.value.copy(this.position)

        this.rotation = angle
        this.mesh.rotation.y = - angle
    }

    setPointerTesting()
    {
        this.game.inputs.addActions([
            { name: 'rayPointer', categories: [ 'playing' ], keys: [ 'Pointer.any' ] },
        ])

        this.game.inputs.events.on('rayPointer', (action) =>
        {
            // Start
            if(action.trigger === 'start')
            {
                this.active = true
                this.mesh.visible = true
            }

            // End
            else if(action.trigger === 'end')
            {
                this.active = false
                this.mesh.visible = false
            }

            // Change
            if(action.trigger === 'start' || action.trigger === 'change')
            {
                if(this.active)
                {
                    // Intersect
                    const ndcPointer = new THREE.Vector2(
                        (this.game.inputs.pointer.current.x / this.game.viewport.width) * 2 - 1,
                        - ((this.game.inputs.pointer.current.y / this.game.viewport.height) * 2 - 1),
                    )
                    this.raycaster.setFromCamera(ndcPointer, this.game.view.defaultCamera)

                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), - this.position.y)
                    const intersect = new THREE.Vector3()
                    this.raycaster.ray.intersectPlane(plane, intersect)

                    // Distance
                    const distance = this.position.distanceTo(intersect)

                    // Target rotation
                    this.targetRotation = Math.atan2(intersect.z - this.position.z, intersect.x - this.position.x)

                    // Progress
                    this.progress = clamp((distance - this.progressRadiusLow) / (this.progressRadiusHigh - this.progressRadiusLow), 0, 1)
                    this.uniforms.progress.value = this.progress
                }
            }
        })
    }

    update()
    {
        if(this.active)
        {
            // Smallest angle and forward
            this.smallestRotation = smallestAngle(this.rotation, this.targetRotation)
            let smallestRotationAbs = Math.abs(this.smallestRotation)

            this.forward = smallestRotationAbs < this.forwardAmplitude / 2
                
            this.uniforms.forward.value = this.forward ? 1 : 0

            // Recalculate, but backward
            if(!this.forward)
                this.smallestRotation = smallestAngle(this.rotation + Math.PI, this.targetRotation)

            if(this.forward)
            {
                this.uniforms.progressStartAngle.value = Math.min(0, this.smallestRotation)
                this.uniforms.progressEndAngle.value = Math.max(0, this.smallestRotation)
            }
            else
            {
                if(this.smallestRotation > 0)
                {
                    this.uniforms.progressStartAngle.value = - Math.PI
                    this.uniforms.progressEndAngle.value = - Math.PI + this.smallestRotation
                }
                else
                {
                    this.uniforms.progressStartAngle.value = Math.PI + this.smallestRotation
                    this.uniforms.progressEndAngle.value = Math.PI
                }
            }

            // Color multiplier
            this.uniforms.colorMultiplier.value = this.progress === 1 ? 1.5 : 1
        }
    }
}