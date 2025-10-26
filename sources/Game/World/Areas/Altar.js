import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { attribute, clamp, color, float, Fn, instancedArray, luminance, max, mix, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import gsap from 'gsap'
import { alea } from 'seedrandom'
import { Area } from './Area.js'

export class Altar extends Area
{
    constructor(references)
    {
        super(references)

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '💀 Altar',
                expanded: false,
            })
        }

        this.value = 0
        this.position = this.references.get('altar')[0].position.clone()

        this.color = uniform(color('#ff544d'))
        this.emissive = uniform(8)

        this.setBeam()
        this.setBeamParticles()
        this.setCounter()
        this.setDeathZone()
        this.setSkullEyes()
        this.setData()
        this.setAchievement()

        // Offline counter
        if(!this.game.server.connected)
            this.updateValue('...')
            
        this.game.server.events.on('disconnected', () =>
        {
            this.updateValue('...')
        })

        // Debug
        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.color.value, 'color')
            this.debugPanel.addBinding(this.emissive, 'value', { label: 'emissive', min: 0, max: 10, step: 0.1 })
        }
    }

    setBeam()
    {
        const radius = 2.5
        this.height = 6
        this.beamAttenuation = uniform(1)

        // Cylinder
        const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, this.height, 32, 1, true)
        cylinderGeometry.translate(0, this.height * 0.5, 0)
        
        const cylinderMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })

        cylinderMaterial.outputNode = Fn(() =>
        {
            const baseUv = uv()

            // Noise
            const noiseUv = vec2(baseUv.x.mul(6).add(baseUv.y.mul(-2)), baseUv.y.mul(1).sub(this.game.ticker.elapsedScaledUniform.mul(0.2)))
            const noise = texture(this.game.noises.perlin, noiseUv).r
            noise.addAssign(baseUv.y.mul(this.beamAttenuation.add(1)))

            // Emissive
            const emissiveColor = this.color.mul(this.emissive)

            // Goo
            const gooColor = this.game.fog.strength.mix(vec3(0), this.game.fog.color) // Fog

            // Mix
            // const gooMask = step(noise, 0.95)
            const gooMask = step(0.65, noise)
            const finalColor = mix(emissiveColor, gooColor, gooMask)

            // Discard
            noise.greaterThan(1).discard()
            
            return vec4(finalColor, 1)
        })()

        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.copy(this.position)
        this.game.scene.add(cylinder)

        // Bottom
        const bottomGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1)

        const satanStarTexture = this.game.resources.satanStarTexture
        satanStarTexture.minFilter = THREE.NearestFilter
        satanStarTexture.magFilter = THREE.NearestFilter
        satanStarTexture.generateMipmaps = false
        
        const bottomMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true })
        bottomMaterial.outputNode = Fn(() =>
        {
            const newUv = uv().sub(0.5).mul(1.7).add(0.5)
            const satanStar = texture(satanStarTexture, newUv).r

            const gooColor = this.game.fog.strength.mix(vec3(0), this.game.fog.color) // Fog

            const emissiveColor = this.color.mul(this.emissive)
            
            const finalColor = mix(gooColor, emissiveColor, satanStar)

            return vec4(finalColor, 1)
        })()

        const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial)
        bottom.position.copy(this.position)
        bottom.rotation.x = - Math.PI * 0.5
        this.game.scene.add(bottom)

        this.animateBeam = () =>
        {
            gsap.to(
                this.beamAttenuation,
                { value: 0, ease: 'power2.out', duration: 0.4, onComplete: () =>
                {
                    gsap.to(
                        this.beamAttenuation,
                        { value: 1, ease: 'power2.inOut', duration: 5, delay: 1 },
                    )
                } },
            )
        }
    }

    setBeamParticles()
    {
        const count = 150

        // Uniforms
        const progress = uniform(0)
        
        // Attributes
        const positionArray = new Float32Array(count * 3)
        const scaleArray = new Float32Array(count)
        const randomArray = new Float32Array(count)
        
        for(let i = 0; i < count; i++)
        {
            const i3 = i * 3

            const spherical = new THREE.Spherical(
                (1 - Math.pow(1 - Math.random(), 2)) * 5,
                Math.random() * Math.PI * 0.4,
                Math.random() * Math.PI * 2
            )
            const position = new THREE.Vector3().setFromSpherical(spherical)
            positionArray[i3 + 0] = position.x
            positionArray[i3 + 1] = position.y
            positionArray[i3 + 2] = position.z

            scaleArray[i] = Math.random()
            randomArray[i] = Math.random()
        }
        const position = instancedArray(positionArray, 'vec3').toAttribute()
        const scale = instancedArray(scaleArray, 'float').toAttribute()
        const random = instancedArray(randomArray, 'float').toAttribute()

        // Geometry
        const particlesGeometry = new THREE.PlaneGeometry(0.2, 0.2)

        // Material
        const particlesMaterial = new THREE.SpriteNodeMaterial()
        particlesMaterial.outputNode = Fn(() =>
        {
            const distanceToCenter = uv().sub(0.5).length()
            const gooColor = this.game.fog.strength.mix(vec3(0), this.game.fog.color) // Fog
            const emissiveColor = this.color.mul(this.emissive)
            const finalColor = mix(gooColor, emissiveColor, step(distanceToCenter, 0.35))

            // Discard
            distanceToCenter.greaterThan(0.5).discard()

            return vec4(finalColor, 1)
        })()
        particlesMaterial.positionNode = Fn(() =>
        {
            const localProgress = progress.remapClamp(0, 0.5, 1, 0).pow(6).oneMinus()
            
            const finalPosition = position.toVar().mulAssign(localProgress)
            finalPosition.y.addAssign(progress.mul(random))

            return finalPosition
        })()
        particlesMaterial.scaleNode = Fn(() =>
        {
            const finalScale = smoothstep(1, 0.3, progress).mul(scale)
            return finalScale
        })()
        
        // Mesh
        const particles = new THREE.Mesh(particlesGeometry, particlesMaterial)
        particles.count = count
        particles.position.copy(this.position)
        particles.position.y -= 0.1
        this.game.scene.add(particles)

        this.animateBeamParticles = () =>
        {
            gsap.fromTo(
                progress,
                { value: 0 },
                { value: 1, ease: 'linear', duration: 3 },
            )
        }
    }

    setCounter()
    {
        const size = 3

        // Canvas
        const ratio = 1 / 4
        this.width = 256
        this.height = this.width * ratio
        this.font = `700 ${this.height}px "Amatic SC"`
        
        const canvas = document.createElement('canvas')
        canvas.width = this.width
        canvas.height = this.height

        this.textTexture = new THREE.Texture(canvas)
        this.textTexture.colorSpace = THREE.SRGBColorSpace
        this.textTexture.minFilter = THREE.NearestFilter
        this.textTexture.magFilter = THREE.NearestFilter
        this.textTexture.generateMipmaps = false

        this.context = canvas.getContext('2d')
        this.context.font = this.font

        // Geometry
        const geometry = new THREE.PlaneGeometry(size, size * ratio, 1, 1)

        // Material
        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        material.outputNode = Fn(() =>
        {
            const textData = texture(this.textTexture, uv())
            const gooColor = this.game.fog.strength.mix(vec3(0), this.game.fog.color) // Fog
            const emissiveColor = this.color.mul(this.emissive)
            const finalColor = mix(gooColor, emissiveColor, textData.g)

            // Discard
            textData.r.add(textData.g).lessThan(0.5).discard()

            return vec4(finalColor, 1)
        })()

        // Mesh
        this.mesh = new THREE.Mesh(geometry, material)
        this.references.get('counter')[0].add(this.mesh)
    }

    setDeathZone()
    {
        const position = this.position.clone()
        position.y -= 1.25
        const zone = this.game.zones.create('sphere', position, 2.5)

        zone.events.on(
            'enter',
            () =>
            {
                // Inside the area
                this.animateBeam()
                this.animateBeamParticles()
                this.data.insert()
                this.updateValue(this.value + 1)
                this.game.player.die()
            }
        )
    }

    setData()
    {
        this.data = {}
        
        this.data.insert = () =>
        {
            this.game.server.send({
                type: 'cataclysmInsert'
            })
        }

        // Server message event
        this.game.server.events.on('message', (data) =>
        {
            // Init and insert
            if(data.type === 'init' || data.type === 'cataclysmUpdate')
            {
                this.updateValue(data.cataclysmCount)
                this.updateSkullEyes(data.cataclysmProgress)
            }
        })

        // Init message already received
        if(this.game.server.initData)
        {
            this.updateValue(this.game.server.initData.cataclysmCount)
            this.updateSkullEyes(this.game.server.initData.cataclysmProgress)
        }
    }

    setSkullEyes()
    {
        this.skullEyes = this.references.get('skullEyes')
        for(const skullEyes of this.skullEyes)
            skullEyes.visible = true
    }

    updateSkullEyes(progress)
    {
        const count = Math.min(Math.floor(progress * 6), 5)
        let i = 0
        for(const skullEyes of this.skullEyes)
        {
            skullEyes.visible = i < count

            i++
        }
    }

    updateValue(value)
    {
        let formatedValue = null

        // Displaying number value
        if(typeof value === 'number')
        {
            // Same value
            if(value === this.value)
                return
                
            this.value = value
            formatedValue = value.toLocaleString('en-US')
        }

        // Displaying text value
        else
        {
            formatedValue = value
        }

        this.context.font = this.font

        this.context.fillStyle = '#000000'
        this.context.fillRect(0, 0, this.width, this.height)

        this.context.font = this.font
        this.context.textAlign = 'center'
        this.context.textBaseline = 'middle'

        this.context.strokeStyle = '#ff0000'
        this.context.lineWidth = this.height * 0.15
        this.context.strokeText(formatedValue, this.width * 0.5, this.height * 0.55)

        this.context.fillStyle = '#00ff00'
        this.context.fillText(formatedValue, this.width * 0.5, this.height * 0.55)

        this.textTexture.needsUpdate = true

        gsap.to(
            this.mesh.scale,
            {
                x: 1.5,
                y: 1.5,
                duration: 0.3,
                overwrite: true,
                onComplete: () =>
                {
                    gsap.to(
                        this.mesh.scale,
                        {
                            x: 1,
                            y: 1,
                            duration: 2,
                            ease: 'elastic.out(1,0.3)',
                            overwrite: true
                        }
                    )
                }
            }
        )
    }

    setAchievement()
    {
        this.events.on('enter', () =>
        {
            this.game.achievements.setProgress('altarEnter', 1)
        })
    }
}