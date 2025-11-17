import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { atan, Fn, PI, PI2, positionGeometry, texture, uniform, vec3, vec4 } from 'three/tsl'
import gsap from 'gsap'
import { Inputs } from '../Inputs/Inputs.js'

export class Intro
{
    constructor()
    {
        this.game = Game.getInstance()

        const respawn = this.game.respawns.getDefault()
        this.center = respawn.position.clone()

        this.setCircle()
        this.setLabel()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setLabel()
    {
        this.label = new THREE.Group()
        this.label.position.copy(this.center)
        this.label.position.x += 3.5
        this.label.position.z -= 1
        this.label.position.y = 3.3
        this.label.rotation.y = 0.4
        this.label.scale.setScalar(0.01)
        this.game.scene.add(this.label)
    }

    setCircle()
    {
        this.circle = {}
        
        const radius = 3.5
        const thickness = 0.04
        this.circle.progress = 0
        this.circle.smoothedProgress = uniform(0)

        // Geometry
        const geometry = new THREE.RingGeometry(radius - thickness, radius, 128, 1)

        // Material
        const material = new THREE.MeshBasicNodeMaterial()
        material.outputNode = Fn(() =>
        {
            const angle = atan(positionGeometry.y, positionGeometry.x)
            const angleProgress = angle.div(PI2).add(0.5).oneMinus()

            this.circle.smoothedProgress.lessThan(angleProgress).discard()

            return vec4(this.game.reveal.color.mul(this.game.reveal.intensity), 1)
        })()

        // Mesh
        const mesh = new THREE.Mesh(geometry, material)
        
        mesh.position.copy(this.center)
        mesh.position.y = 0.001
        mesh.rotation.x = - Math.PI * 0.5
        mesh.rotation.z = Math.PI * 0.5
        
        this.game.scene.add(mesh)

        this.circle.mesh = mesh

        // Hide
        this.circle.hide = (callback = null) =>
        {
            const dummy = { scale: 1 }
            const speedMultiplier = this.game.debug.active ? 4 : 1
            gsap.to(
                dummy,
                {
                    scale: 0,
                    duration: 1.5 / speedMultiplier,
                    // ease: 'back.in(1.7)',
                    ease: 'power4.in',
                    overwrite: true,
                    onUpdate: () =>
                    {
                        mesh.scale.setScalar(dummy.scale)
                    },
                    onComplete: () =>
                    {
                        if(typeof callback === 'function')
                            callback()

                        mesh.removeFromParent()
                    }
                }
            )
        }
    }

    setText()
    {
        // Geometry
        const scale = 1.3
        const geometry = new THREE.PlaneGeometry(2 * scale, 1 * scale)

        // Texture
        const textures = new Map()
        const updateTexture = async () =>
        {
            // Define name
            let name = 'mouseKeyboard'
            
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
            {
                if(this.game.inputs.gamepad.type === 'xbox')
                {
                    name = 'gamepadXbox'
                }
                else
                {
                    name = 'gamepadPlaystation'
                }
            }
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
            {
                name = 'touch'
            }

            // Load, set and save texture
            let texture = textures.get(name)
            if(!texture)
            {
                const resourceName = `introLabel${name}`
                const resourcePath = `intro/${name}Label.png`
                const resources = await this.game.resourcesLoader.load([
                    [ resourceName, resourcePath, 'texture' ],
                ])
                texture = resources[resourceName]
                textures.set(name, texture)
            }

            // Update material and mesh
            material.alphaMap = texture
            material.needsUpdate = true
            mesh.visible = true
        }

        updateTexture()

        // Material
        const material = new THREE.MeshBasicNodeMaterial({
            alphaTest: 0.5,
            transparent: true
        })

        this.game.inputs.gamepad.events.on('typeChange', () =>
        {
            updateTexture()
        })

        this.game.inputs.events.on('modeChange', () =>
        {
            updateTexture()
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.visible = false

        this.label.add(mesh)

        this.text = mesh
    }

    setSoundButton()
    {
        this.soundButton = {}

        // Texture
        const texture = this.game.resources.soundTexture
        
        if(this.game.audio.muteToggle.active)
            texture.offset.x = 0.5

        // Geometry
        const scale = 0.5
        const geometry = new THREE.PlaneGeometry(50 / 38 * scale, 1 * scale)

        // Material
        const intensity = uniform(1)
        const material = new THREE.MeshBasicNodeMaterial({
            alphaTest: 0.5,
            alphaMap: texture,
            transparent: true,
            outputNode: vec4(vec3(1).mul(intensity), 1)
        })

        // Mesh
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.x = 0.38
        mesh.position.y = - 1
        this.label.add(mesh)

        // Intersect
        const position = this.label.position.clone()
        position.x += 0.38
        position.y += - 1

        this.soundButton.intersect = this.game.rayCursor.addIntersects({
            active: true,
            shapes:
            [
                new THREE.Sphere(position, 0.5)
            ],
            onClick: () =>
            {
                this.game.audio.muteToggle.toggle()
                texture.offset.x = this.game.audio.muteToggle.active ? 0.5 : 0
            },
            onEnter: () =>
            {
                gsap.to(intensity, { value: 1.5, duration: 0.3, overwrite: true })
            },
            onLeave: () =>
            {
                gsap.to(intensity, { value: 1, duration: 0.3, overwrite: true })
            }
        })

        this.soundButton.mesh = mesh
    }

    showLabel()
    {
        const dummy = { scale: 0 }
        const speedMultiplier = this.game.debug.active ? 4 : 1
        gsap.to(
            dummy,
            {
                scale: 1,
                duration: 2 / speedMultiplier,
                delay: 1 / speedMultiplier,
                ease: 'elastic.out(0.5)',
                overwrite: true,
                onUpdate: () =>
                {
                    this.label.scale.setScalar(dummy.scale)
                }
            }
        )
    }

    hideLabel()
    {
        const speedMultiplier = this.game.debug.active ? 4 : 1
        const dummy = { scale: 1 }
        gsap.to(
            dummy,
            {
                scale: 0,
                duration: 0.3 / speedMultiplier,
                ease: 'power2.in',
                overwrite: true,
                onUpdate: () =>
                {
                    this.label.scale.setScalar(dummy.scale)
                },
                onComplete: () =>
                {
                    this.text.removeFromParent()
                    this.soundButton.mesh.removeFromParent()
                    this.game.rayCursor.removeIntersect(this.soundButton.intersect)
                }
            }
        )
    }

    updateProgress(progress)
    {
        this.circle.progress = progress
    }

    update()
    {
        this.circle.smoothedProgress.value += (this.circle.progress - this.circle.smoothedProgress.value) * this.game.ticker.delta * 10
    }
}