import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, color, cross, float, floor, Fn, instancedArray, min, modelWorldMatrix, mul, positionGeometry, step, uniform, varying, vec3, vec4, vertexIndex } from 'three/tsl'
import { LineGeometry } from '../Geometries/LineGeometry.js'
import gsap from 'gsap'

export class Lightnings
{
    constructor()
    {
        this.game = Game.getInstance()

        this.nightChances = 0.25
        this.hitChances = 0
        this.frequency = 10

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '⚡️ Lightnings',
                expanded: true,
            })

            this.debugPanel.addBinding(this, 'nightChances', { min: 0, max: 1, step: 0.001 })
            this.hitChancesTweak = this.debugPanel.addBinding(this, 'hitChances', { min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this, 'frequency', { min: 0.1, max: 10, step: 0.1 })

            this.game.debug.addButtons(
                this.debugPanel,
                {
                    start: () => { this.start() },
                    stop: () => {this.stop()  },
                    create: () =>
                    {
                        const angle = Math.random() * Math.PI * 2
                        const position = new THREE.Vector3(
                            Math.cos(angle) + Math.cos(angle) * 2,
                            0,
                            Math.sin(angle) + Math.sin(angle) * 2
                        )
                        this.create(position)
                    },
                },
                'actions'
            )
            
            this.debugPanel.addBlade({ view: 'separator' })
        }

        this.materialReference = this.game.materials.createEmissive('lightnings', '#4c8bff', 4, this.debugPanel)

        this.setAnticipationParticles()
        this.setArc()
        this.setExplosionParticles()
        
        this.setInterval()
    }

    setAnticipationParticles()
    {
        this.anticipationParticles = {}
        this.anticipationParticles.count = 32
        this.anticipationParticles.duration = 5

        // Uniforms
        const durationUniform = uniform(this.anticipationParticles.duration)
        const scaleUniform = uniform(0.07)
        const elevationUniform = uniform(1.5)

        // Buffers
        const positionArray = new Float32Array(this.anticipationParticles.count * 3)
        const scaleArray = new Float32Array(this.anticipationParticles.count)

        for(let i = 0; i < this.anticipationParticles.count; i++)
        {
            const i3 = i * 3
            const angle = Math.PI * 2 * Math.random()
            const radius = Math.random() * 3
            positionArray[i3 + 0] = Math.sin(angle) * radius
            positionArray[i3 + 1] = - Math.random()
            positionArray[i3 + 2] = Math.cos(angle) * radius

            scaleArray[i] = Math.random() * 0.75 + 0.25
        }

        this.anticipationParticles.positionAttribute = instancedArray(positionArray, 'vec3').toAttribute()
        this.anticipationParticles.scaleAttribute = instancedArray(scaleArray, 'float').toAttribute()

        this.anticipationParticles.geometry = new THREE.PlaneGeometry(1, 1)

        const finalPosition = varying(vec3())

        // Position node
        this.anticipationParticles.positionNode = Fn(([_startTime]) =>
        {
            const localTime = this.game.time.elapsedScaledUniform.sub(_startTime)
            finalPosition.assign(this.anticipationParticles.positionAttribute)
            const timeProgress = min(localTime.div(this.anticipationParticles.duration), 1)
            
            finalPosition.y.addAssign(timeProgress.mul(elevationUniform))

            return finalPosition
        })

        // Scale node
        this.anticipationParticles.scaleNode = Fn(([_startTime]) =>
        {
            const localTime = this.game.time.elapsedScaledUniform.sub(_startTime)
            const duration = float(this.anticipationParticles.duration)
            const timeScale = localTime.remapClamp(duration.mul(0.5), duration, 1, 0)
            const elevationScale = finalPosition.y.remapClamp(0, 0.2, 0, 1)
            const finalScale = this.anticipationParticles.scaleAttribute.mul(scaleUniform).mul(timeScale).mul(elevationScale)
            return finalScale
        })

        // Create
        this.anticipationParticles.create = (coordinates) =>
        {
            // Uniforms
            const startTime = uniform(this.game.time.elapsedScaled)
            
            // Material
            const material = new THREE.SpriteNodeMaterial()
            material.color = this.materialReference.color
            material.positionNode = this.anticipationParticles.positionNode(startTime)
            material.scaleNode = this.anticipationParticles.scaleNode(startTime)
            
            const mesh = new THREE.Mesh(this.anticipationParticles.geometry, material)
            mesh.position.copy(coordinates)
            mesh.rotation.y = Math.random() * Math.PI * 2
            mesh.count = this.anticipationParticles.count
            this.game.scene.add(mesh)

            return mesh
        }

        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({ title: 'Anticipation' })
            debugPanel
                .addBinding(this.anticipationParticles, 'duration', { min: 0, max: 10, step: 0.01 })
                .on('change', () => { durationUniform.value = this.anticipationParticles.duration })
            debugPanel.addBinding(scaleUniform, 'value', { label: 'scale', min: 0, max: 1, step: 0.001 })
            debugPanel.addBinding(elevationUniform, 'value', { label: 'elevation', min: 0, max: 5, step: 0.01 })
        }
    }

    setArc()
    {
        this.arc = {}
        this.arc.duration = 3

        // Geometry
        const points = []
        const pointsCount = 15
        const height = 15
        const interY = height / (pointsCount - 1)

        for(let i = 0; i < pointsCount; i++)
        {
            const point = new THREE.Vector3(
                (Math.random() - 0.5) * 1,
                i * interY,
                (Math.random() - 0.5) * 1
            )
            points.push(point)
        }

        this.arc.geometry = new LineGeometry(points)

        // Uniforms
        const thicknessUniform = uniform(0.1)
        const easeOutUniform = uniform(5)
        const driftAmplitudeUniform = uniform(1)

        // Vertex Node
        this.arc.vertexNode = Fn(([_startTime]) =>
        {
            const ratio = attribute('ratio')
            const tipness = ratio.step(0.01)
            const localTime = this.game.time.elapsedScaledUniform.sub(_startTime)
            const timeProgress = min(localTime.div(this.arc.duration), 1)
            
            const newPosition = positionGeometry.toVar()
            newPosition.xz.mulAssign(timeProgress.oneMinus().pow(easeOutUniform).oneMinus().mul(tipness.oneMinus()).mul(driftAmplitudeUniform).add(1))

            const worldPosition = modelWorldMatrix.mul(vec4(newPosition, 1))
            const toCamera = worldPosition.xyz.sub(cameraPosition).normalize()

            const nextPosition = positionGeometry.add(attribute('direction'))
            const nextWorldPosition = modelWorldMatrix.mul(vec4(nextPosition, 1))
            const nextDelta = nextWorldPosition.xyz.sub(worldPosition.xyz).normalize()
            const tangent = cross(nextDelta, toCamera).normalize()
            
            const ratioThickness = ratio.mul(10).min(1)
            const timeThickness = timeProgress.oneMinus()
            const finalThickness = mul(thicknessUniform, ratioThickness, timeThickness)

            const sideStep = floor(vertexIndex.toFloat().mul(3).sub(2).div(3).mod(2)).sub(0.5)
            const sideOffset = tangent.mul(sideStep.mul(finalThickness))
            
            worldPosition.addAssign(vec4(sideOffset, 0))

            const viewPosition = cameraViewMatrix.mul(worldPosition)
            return cameraProjectionMatrix.mul(viewPosition)
        })

        // Create
        this.arc.create = (coordinates) =>
        {
            // Uniforms
            const startTime = uniform(this.game.time.elapsedScaled)

            // Material
            const material = new THREE.MeshBasicNodeMaterial({ wireframe: false })
            material.color = this.materialReference.color
            material.vertexNode = this.arc.vertexNode(startTime)

            const mesh = new THREE.Mesh(this.arc.geometry, material)
            mesh.position.copy(coordinates)
            mesh.rotation.y = Math.random() * Math.PI * 2
            this.game.scene.add(mesh)
            
            return mesh
        }

        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({ title: 'Arc' })
            debugPanel.addBinding(this.arc, 'duration', { min: 0, max: 10, step: 0.01 })
            debugPanel.addBinding(easeOutUniform, 'value', { label: 'easeOut', min: 1, max: 10, step: 1 })
            debugPanel.addBinding(driftAmplitudeUniform, 'value', { label: 'driftAmplitude', min: 0, max: 3, step: 0.001 })
            debugPanel.addBinding(thicknessUniform, 'value', { label: 'thickness', min: 0, max: 1, step: 0.001 })
        }
    }

    setExplosionParticles()
    {
        this.explosionParticles = {}
        this.explosionParticles.count = 128
        this.explosionParticles.duration = 4
        this.explosionParticles.fallAmplitude = 1
        
        // Buffers
        const positionArray = new Float32Array(this.explosionParticles.count * 3)
        const scaleArray = new Float32Array(this.explosionParticles.count)

        for(let i = 0; i < this.explosionParticles.count; i++)
        {
            const i3 = i * 3
            const spherical = new THREE.Spherical(
                Math.random(),
                Math.random() * 0.5 * Math.PI,
                Math.random() * Math.PI * 2
            )
            const position = new THREE.Vector3().setFromSpherical(spherical)
            positionArray[i3 + 0] = position.x
            positionArray[i3 + 1] = position.y
            positionArray[i3 + 2] = position.z

            scaleArray[i] = Math.random() * 0.75 + 0.25
        }

        this.explosionParticles.positionAttribute = instancedArray(positionArray, 'vec3').toAttribute()
        this.explosionParticles.scaleAttribute = instancedArray(scaleArray, 'float').toAttribute()

        // Geometry
        this.explosionParticles.geometry = new THREE.PlaneGeometry()

        // Uniforms
        const scaleUniform = uniform(0.1)
        const radiusUniform = uniform(3)
        const easeOutUniform = uniform(8)

        // Position node
        this.explosionParticles.positionNode = Fn(([_startTime]) =>
        {
            const localTime = this.game.time.elapsedScaledUniform.sub(_startTime)
            const timeProgress = min(localTime.div(float(this.explosionParticles.duration).mul(0.75)), 1)
            
            const newPosition = this.explosionParticles.positionAttribute.toVar()
            newPosition.mulAssign(timeProgress.oneMinus().pow(easeOutUniform).oneMinus().mul(radiusUniform))

            return newPosition
        })

        // Scale node
        this.explosionParticles.scaleNode = Fn(([_startTime]) =>
        {
            const localTime = this.game.time.elapsedScaledUniform.sub(_startTime)
            const timeScale = localTime.div(this.explosionParticles.duration).oneMinus().max(0)
            const finalScale = this.explosionParticles.scaleAttribute.mul(scaleUniform).mul(timeScale)
            return finalScale
        })

        // Create
        this.explosionParticles.create = (coordinates) =>
        {
            const startTime = uniform(this.game.time.elapsedScaled)
        
            const material = new THREE.SpriteNodeMaterial()
            material.color = this.materialReference.color
            material.positionNode = this.explosionParticles.positionNode(startTime)
            material.scaleNode = this.explosionParticles.scaleNode(startTime)
            
            const mesh = new THREE.Mesh(this.explosionParticles.geometry, material)
            mesh.position.copy(coordinates)
            mesh.count = this.explosionParticles.count
            mesh.rotation.y = Math.random() * Math.PI * 2
            this.game.scene.add(mesh)

            gsap.to(mesh.position, { y: - this.explosionParticles.fallAmplitude, duration: this.explosionParticles.duration })
            
            return mesh
        }

        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({ title: 'Explosion' })
            debugPanel.addBinding(this.explosionParticles, 'duration', { min: 0, max: 10, step: 0.01 })
            debugPanel.addBinding(easeOutUniform, 'value', { label: 'easeOut', min: 1, max: 10, step: 1 })
            debugPanel.addBinding(scaleUniform, 'value', { label: 'scale', min: 0, max: 1, step: 0.001 })
            debugPanel.addBinding(radiusUniform, 'value', { label: 'radius', min: 0, max: 10, step: 0.001 })
            debugPanel.addBinding(this.explosionParticles, 'fallAmplitude', { min: 0, max: 2, step: 0.001 })
        }
    }

    createRandom()
    {
        const focusPointPosition = this.game.view.focusPoint.position
        this.create(new THREE.Vector3(
            focusPointPosition.x + (Math.random() - 0.5) * this.game.view.optimalArea.radius * 2,
            0,
            focusPointPosition.z + (Math.random() - 0.5) * this.game.view.optimalArea.radius * 2
        ))
    }

    create(coordinates)
    {
        const disposables = []
        
        // Anticipation
        disposables.push(this.anticipationParticles.create(coordinates))

        gsap.delayedCall(this.anticipationParticles.duration, () =>
        {
            // Game explosion
            this.game.explosions.explode(coordinates)
            
            // Arc
            disposables.push(this.arc.create(coordinates))

            // Explosion particles
            disposables.push(this.explosionParticles.create(coordinates))

            // Wait and destroy
            const duration = Math.max(this.arc.duration, this.explosionParticles.duration)
            gsap.delayedCall(duration, () =>
            {
                for(const disposable of disposables)
                {
                    disposable.removeFromParent()
                    disposable.material.dispose()
                }
            })
        })
    }

    start()
    {
        this.hitChances = Math.random()
        this.hitChancesTweak.refresh()
    }

    stop()
    {
        this.hitChances = 0
        this.hitChancesTweak.refresh()
    }

    setInterval()
    {
        this.game.dayCycles.addIntervalEvent('lightning', 0.4, 0.6)
        this.game.dayCycles.events.on('lightning', (atNight) =>
        {
            if(atNight)
            {
                if(Math.random() < this.nightChances) // Chances having ligtnings night
                    this.start()
            }
            else
            {
                this.stop()
            }
        })

        const tryCreate = () =>
        {
            if(Math.random() < this.hitChances)
                this.createRandom()

            gsap.delayedCall(1 / this.frequency, tryCreate)
        }

        tryCreate()
    }
}