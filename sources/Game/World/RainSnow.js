import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, float, Fn, hash, instancedArray, instanceIndex, materialNormal, max, mod, positionGeometry, rotateUV, sin, smoothstep, step, storage, texture, uniform, vec2, vec3, vec4 } from 'three/tsl'
import { remapClamp } from '../utilities/maths.js'

export class RainSnow
{
    constructor()
    {
        this.game = Game.getInstance()

        this.count = Math.pow(2, 13)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌧️ Rain / Snow',
                expanded: false,
            })
        }

        this.setGeometry()
        this.setMaterial()
        this.setMesh()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setGeometry()
    {
        this.geometry = new THREE.PlaneGeometry(1, 1)
    }

    setMaterial()
    {
        this.material = new THREE.SpriteNodeMaterial({ side: THREE.DoubleSide })

        this.size = float(this.game.view.optimalArea.radius)
        this.elevation = float(15)

        // Uniforms
        this.visibleRatio = uniform(0)
        this.focusPoint = uniform(vec2())
        this.scale = uniform(0.03)
        this.windFrequency = uniform(0.005)
        this.windMultiplier = uniform(0.003)
        this.defaultDamping = uniform(0.02)
        this.weight = uniform(0.1)
        this.gravity = uniform(0.001)
        
        // Buffers
        this.positionBuffer = instancedArray(this.count, 'vec3')
        this.velocityBuffer = instancedArray(this.count, 'vec3')

        // Scale
        const scaleArray = new Float32Array(this.count)
        for(let i = 0; i < this.count; i++)
            scaleArray[i] = Math.random() * 0.5 + 0.5
        const scaleBuffer = storage(new THREE.StorageInstancedBufferAttribute(scaleArray, 1), 'float', this.count).toAttribute()
        
        // Output color
        this.material.outputNode = this.game.lighting.lightOutputNodeBuilder(color('#ffffff'), this.game.lighting.addTotalShadowToMaterial(this.material))

        // Position
        this.material.positionNode = Fn(() =>
        {
            // Normal
            materialNormal.assign(vec3(1, 1, 1).normalize())

            // Position
            const dropPosition = this.positionBuffer.toAttribute().toVar()
            dropPosition.y.addAssign(this.visibleRatio.step(float(instanceIndex).div(this.count)).mul(this.elevation).mul(2))
            return dropPosition
        })()

        // Scale
        this.material.scaleNode = this.scale.mul(scaleBuffer)

        // Init
        const init = Fn(() =>
        {
            // Position
            const position = this.positionBuffer.element(instanceIndex)
            
            position.assign(vec3(
                hash(instanceIndex).sub(0.5).mul(this.size),
                hash(instanceIndex.add(1)).mul(this.elevation),
                hash(instanceIndex.add(2)).sub(0.5).mul(this.size)
            ))
        })()
        const initCompute = init.compute(this.count)

        this.game.rendering.renderer.computeAsync(initCompute)

        // Update
        const update = Fn(() =>
        {
            const position = this.positionBuffer.element(instanceIndex)
            const velocity = this.velocityBuffer.element(instanceIndex)
            
            // Wind
            const noiseUv = position.xz.mul(this.windFrequency).add(this.game.wind.direction.mul(this.game.wind.localTime)).xy
            const noise = smoothstep(0.4, 1, texture(this.game.noises.others, noiseUv).r)

            const windStrength = this.game.wind.strength.mul(noise).mul(this.windMultiplier).toVar()
            velocity.x.addAssign(this.game.wind.direction.x.mul(windStrength))
            velocity.z.addAssign(this.game.wind.direction.y.mul(windStrength))

            // Damping
            velocity.mulAssign(float(1).sub(this.defaultDamping))

            // Gravity
            velocity.y = velocity.y.sub(this.gravity.mul(this.weight))

            // Apply velocity
            position.addAssign(velocity)

            // Horizontal loop
            const halfSize = this.size.mul(0.5).toVar()
            position.x.assign(mod(position.x.add(halfSize).sub(this.focusPoint.x), this.size).sub(halfSize).add(this.focusPoint.x))
            position.z.assign(mod(position.z.add(halfSize).sub(this.focusPoint.y), this.size).sub(halfSize).add(this.focusPoint.y))
            
            // Vertical loop
            position.y.assign(mod(position.y, this.elevation))
        })()
        this.updateCompute = update.compute(this.count)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this.scale, 'value', { label: 'scale', min: 0, max: 0.1, step: 0.001 })
            this.debugPanel.addBinding(this.windFrequency, 'value', { label: 'windFrequency', min: 0, max: 0.02, step: 0.00001 })
            this.debugPanel.addBinding(this.windMultiplier, 'value', { label: 'windMultiplier', min: 0, max: 0.02, step: 0.00001 })
            this.debugPanel.addBinding(this.defaultDamping, 'value', { label: 'defaultDamping', min: 0, max: 0.05, step: 0.00001 })
            this.debugPanel.addBinding(this.gravity, 'value', { label: 'gravity', min: 0, max: 0.1, step: 0.00001 })
        }
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.count = this.count
        this.mesh.frustumCulled = false
        this.game.scene.add(this.mesh)
    }

    update()
    {
        // Apply weather
        this.visibleRatio.value = this.game.weather.rain.value
        this.weight.value = remapClamp(this.game.weather.temperature.value, 5, -5, 1, 0.1)

        this.mesh.visible = this.visibleRatio.value > 0.00001
        
        if(!this.mesh.visible)
            return

        const optimalAreaPosition = this.game.view.optimalArea.position
        const cameraPosition = this.game.view.defaultCamera.position
        const focusPoint = optimalAreaPosition.clone().lerp(cameraPosition, 0.5)
        this.focusPoint.value.set(focusPoint.x, focusPoint.z)

        this.game.rendering.renderer.computeAsync(this.updateCompute)
    }
}