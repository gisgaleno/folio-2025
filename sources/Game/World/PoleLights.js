import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, float, Fn, hash, instance, instancedBufferAttribute, instanceIndex, luminance, mix, PI2, positionLocal, sin, storage, texture, uniform, uniformArray, uv, vec3, vec4 } from 'three/tsl'
import { remap, smoothstep } from '../utilities/maths.js'
import gsap from 'gsap'

export class PoleLights
{
    constructor()
    {
        this.game = Game.getInstance()

        this.model = this.game.resources.poleLightsModel.scene

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏮 Pole lights',
                expanded: false,
            })
        }

        this.setBase()
        this.setEmissives()
        this.setFireflies()
        this.setSwitchInterval()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setBase()
    {
        this.game.materials.updateObject(this.model)
        this.game.scene.add(this.model)

        this.model.traverse(_child =>
        {
            if(_child.isMesh)
            {
                _child.castShadow = true
                _child.receiveShadow = _child.name.startsWith('poleLightEmissive') ? false : true
            }
        })
    }

    setEmissives()
    {
        this.emissives = {}
        this.emissives.items = []
        this.model.traverse(_child =>
        {
            if(_child.isMesh && _child.name.startsWith('poleLightEmissive'))
                this.emissives.items.push(_child)
        })
        console.log(this.emissives.items)

        this.emissives.offMaterial = this.game.materials.getFromName('glass')
        this.emissives.onMaterial = this.game.materials.getFromName('emissiveGradientWarm')
    }

    setFireflies()
    {
        this.firefliesScale = uniform(0)

        const countPerLight = 5
        const count = this.emissives.items.length * countPerLight
        const positions = new Float32Array(count * 3)

        let i = 0
        for(const emissive of this.emissives.items)
        {
            for(let j = 0; j < countPerLight; j++)
            {
                const i3 = i * 3

                const angle = Math.random() * Math.PI * 2
                positions[i3 + 0] = emissive.position.x + Math.cos(angle)
                positions[i3 + 1] = emissive.position.y
                positions[i3 + 2] = emissive.position.z + Math.sin(angle)
                i++
            }
        }

        const positionAttribute = storage(new THREE.StorageInstancedBufferAttribute(positions, 3), 'vec3', count).toAttribute()

        const material = new THREE.SpriteNodeMaterial({ color: this.emissives.onMaterial.color })

        const baseTime = this.game.ticker.elapsedScaledUniform.add(hash(instanceIndex).mul(999))
        const flyOffset = vec3(
            sin(baseTime.mul(0.4)).mul(0.5),
            sin(baseTime).mul(0.2),
            sin(baseTime.mul(0.3)).mul(0.5)
        )
        material.positionNode = positionAttribute.add(flyOffset)
        material.scaleNode = this.firefliesScale

        const geometry = new THREE.PlaneGeometry(0.03, 0.03)

        const mesh = new THREE.Mesh(geometry, material)
        mesh.count = count
        mesh.frustumCulled = false
        this.game.scene.add(mesh)
    }

    setSwitchInterval()
    {
        this.game.dayCycles.addIntervalEvent('poleLights', 0.25, 0.7)

        this.game.dayCycles.events.on('poleLights', (inInverval) =>
        {
            if(inInverval)
            {
                for(const emissive of this.emissives.items)
                    emissive.material = this.emissives.onMaterial

                gsap.to(this.firefliesScale, { value: 1, duration: 5 })
            }
            else
            {
                for(const emissive of this.emissives.items)
                    emissive.material = this.emissives.offMaterial

                gsap.to(this.firefliesScale, { value: 0, duration: 5, overwrite: true })
            }
        })
    }

    update()
    {
        
    }
}