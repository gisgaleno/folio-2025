import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { float, Fn, normalWorld, step, storage, texture, uniform, vec4 } from 'three/tsl'

export class CookieStand
{
    constructor(banner, cookieChimneyPosition)
    {
        this.game = Game.getInstance()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🍪 Cookie Stand',
                expanded: true,
            })
        }

        this.banner = banner
        this.chimneyPosition = cookieChimneyPosition

        this.setBanner()
        this.setParticles()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setBanner()
    {
        const material = new THREE.MeshBasicNodeMaterial()

        // Shadow receive
        const totalShadows = this.game.lighting.addTotalShadowToMaterial(material)

        material.outputNode = Fn(() =>
        {
            const baseColor = texture(this.game.resources.cookieBannerTexture)

            // return baseColor
            return this.game.lighting.lightOutputNodeBuilder(baseColor, normalWorld, totalShadows, true, false)
        })()

        this.banner.material = material
    }

    setParticles()
    {
        const emissiveMaterial = this.game.materials.getFromName('emissiveGradientWarm')

        const count = 30
        const elevation = uniform(3)
        const positions = new Float32Array(count * 3)
        const scales = new Float32Array(count)

        this.localTime = uniform(0)

        for(let i = 0; i < count; i++)
        {
            const i3 = i * 3

            const angle = Math.PI * 2 * Math.random()
            const radius = Math.pow(Math.random(), 1.5) * 0.4
            positions[i3 + 0] = Math.cos(angle) * radius
            positions[i3 + 1] = Math.random()
            positions[i3 + 2] = Math.sin(angle) * radius

            scales[i] = Math.random() * 1 + 0.75
        }
        
        const positionAttribute = storage(new THREE.StorageInstancedBufferAttribute(positions, 3), 'vec3', count).toAttribute()
        const scaleAttribute = storage(new THREE.StorageInstancedBufferAttribute(scales, 1), 'float', count).toAttribute()

        const material = new THREE.SpriteNodeMaterial()
        material.colorNode = emissiveMaterial.colorNode

        const progress = float(0).toVar()

        material.positionNode = Fn(() =>
        {
            const newPosition = positionAttribute.toVar()
            progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())

            newPosition.y.assign(progress.mul(elevation))

            const progressHide = step(0.8, progress).mul(100)
            newPosition.y.addAssign(progressHide)
            
            return newPosition
        })()
        material.scaleNode = Fn(() =>
        {
            const progressScale = progress.remapClamp(0.5, 1, 1, 0)
            return scaleAttribute.mul(progressScale)
        })()

        const geometry = new THREE.PlaneGeometry(0.03, 0.03)

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.copy(this.chimneyPosition)
        mesh.count = count
        mesh.frustumCulled = true
        this.game.scene.add(mesh)
    }

    update()
    {
        const timeScale = (Math.sin(this.game.ticker.elapsedScaled) * 0.3 + 0.5) * 0.2
        this.localTime.value += this.game.ticker.deltaScaled * timeScale
    }
}