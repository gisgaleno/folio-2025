import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import MeshGridMaterial, { MeshGridMaterialLine } from './Materials/MeshGridMaterial.js'
import { color, Fn, mix, round, smoothstep, texture, uniform, uv, vec2 } from 'three/tsl'

export class TerrainData
{
    constructor()
    {
        this.game = Game.getInstance()

        this.subdivision = 256
        this.geometry = this.game.resources.terrainModel.scene.children[0].geometry

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏔️ Terrain Data',
                expanded: true,
            })
        }

        this.setGradient()
        this.setNodes()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setGradient()
    {
        const height = 16

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = height

        this.gradientTexture = new THREE.Texture(canvas)
        this.gradientTexture.colorSpace = THREE.SRGBColorSpace

        const context = canvas.getContext('2d')

        const colors = [
            { stop: 0, value: '#ffb869' },
            { stop: 0.3, value: '#5cc294' },
            { stop: 0.9, value: '#13375f' },
        ]

        const update = () =>
        {
            const gradient = context.createLinearGradient(0, 0, 0, height)
            for(const color of colors)
                gradient.addColorStop(color.stop, color.value)

            context.fillStyle = gradient
            context.fillRect(0, 0, 1, height)
            this.gradientTexture.needsUpdate = true
        }

        update()

        // // Debug
        // canvas.style.position = 'fixed'
        // canvas.style.zIndex = 999
        // canvas.style.top = 0
        // canvas.style.left = 0
        // canvas.style.width = '128px'
        // canvas.style.height = `256px`
        // document.body.append(canvas)
        
        if(this.game.debug.active)
        {
            for(const color of colors)
            {
                this.debugPanel.addBinding(color, 'stop', { min: 0, max: 1, step: 0.001 }).on('change', update)
                this.debugPanel.addBinding(color, 'value', { view: 'color' }).on('change', update)
            }
        }
    }

    setNodes()
    {
        this.grassColorUniform = uniform(color('#9eaf33'))
        this.groundDataDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.subdivision).add(0.5).toVar()
        })

        this.terrainDataNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.game.resources.terrainTexture, textureUv)

            // Wheel tracks
            const groundDataColor = texture(
                this.game.groundData.renderTarget.texture,
                position.sub(- this.game.groundData.halfSize).sub(this.groundDataDelta).div(this.game.groundData.size)
            )
            data.g.mulAssign(groundDataColor.r.oneMinus())

            return data
        })
        
        this.colorNode = Fn(([terrainData]) =>
        {
            // Dirt and water
            const baseColor = texture(this.gradientTexture, vec2(0, terrainData.b.oneMinus()))

            // Grass
            baseColor.assign(mix(baseColor, this.grassColorUniform, terrainData.g))

            return baseColor.rgb
        })

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.grassColorUniform.value, 'grassColor')
        }
    }
    
    update()
    {
        // Ground data delta
        this.groundDataDelta.value.set(
            this.game.groundData.focusPoint.x,
            this.game.groundData.focusPoint.y
        )
    }
}