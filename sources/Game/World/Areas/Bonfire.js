import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { InteractivePoints } from '../../InteractivePoints.js'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { alea } from 'seedrandom'
import { Area } from './Area.js'

export class Bonfire extends Area
{
    constructor(references)
    {
        super(references)

        this.position = this.references.get('bonfire')[0].position

        this.setParticles()
        this.setInteractivePoint()
        this.setHashes()
        this.setBurn()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setParticles()
    {
        const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')

        const count = 30
        const elevation = uniform(5)
        const positions = new Float32Array(count * 3)
        const scales = new Float32Array(count)

        this.localTime = uniform(0)

        for(let i = 0; i < count; i++)
        {
            const i3 = i * 3

            const angle = Math.PI * 2 * Math.random()
            const radius = Math.pow(Math.random(), 1.5) * 1
            positions[i3 + 0] = Math.cos(angle) * radius
            positions[i3 + 1] = Math.random()
            positions[i3 + 2] = Math.sin(angle) * radius

            scales[i] = 0.02 + Math.random() * 0.06
        }
        
        const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
        const scaleAttribute = instancedArray(scales, 'float').toAttribute()

        const material = new THREE.SpriteNodeMaterial()
        material.outputNode = emissiveMaterial.outputNode

        const progress = float(0).toVar()

        material.positionNode = Fn(() =>
        {
            const newPosition = positionAttribute.toVar()
            progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())

            newPosition.y.assign(progress.mul(elevation))
            newPosition.xz.addAssign(this.game.wind.direction.mul(progress))

            const progressHide = step(0.8, progress).mul(100)
            newPosition.y.addAssign(progressHide)
            
            return newPosition
        })()
        material.scaleNode = Fn(() =>
        {
            const progressScale = progress.remapClamp(0.5, 1, 1, 0)
            return scaleAttribute.mul(progressScale)
        })()

        const geometry = new THREE.PlaneGeometry(1, 1)

        this.particles = new THREE.Mesh(geometry, material)
        this.particles.visible = false
        this.particles.position.copy(this.position)
        this.particles.count = count
        this.particles.frustumCulled = true
        this.game.scene.add(this.particles)
    }
    
    setInteractivePoint()
    {
        this.game.interactivePoints.create(
            this.references.get('interactivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                // Interactive buttons
                this.game.inputs.interactiveButtons.clearItems()

                // Player respawn
                this.game.player.respawn(null, () =>
                {
                    // Bonfire
                    this.particles.visible = true
                    this.burn.material = this.game.materials.getFromName('emissiveOrangeRadialGradient')

                    // Objects reset
                    this.game.objects.resetAll()

                    // Bowling
                    if(this.game.world.areas.bowling)
                        this.game.world.areas.bowling.restart()
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setHashes()
    {
        const alphaNode = Fn(() =>
        {
            const baseUv = uv()
            const distanceToCenter = baseUv.sub(0.5).length()

            const voronoi = texture(
                this.game.noises.voronoi,
                baseUv
            ).g

            voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))

            return voronoi
        })()

        const material = new MeshDefaultMaterial({
            colorNode: color(0x6F6A87),
            alphaNode: alphaNode,
            hasWater: false,
            hasLightBounce: false
        })

        const mesh = this.references.get('hashes')[0]
        mesh.material = material
    }

    setBurn()
    {
        this.burn = this.references.get('burn')[0]
        this.burn.material = this.game.materials.getFromName('black')
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}