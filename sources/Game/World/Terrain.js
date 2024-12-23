import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import MeshGridMaterial, { MeshGridMaterialLine } from '../Materials/MeshGridMaterial.js'
import { color, mix, output, positionGeometry, positionLocal, remap, remapClamp, smoothstep, texture, uniform, uv, vec3, vec4 } from 'three/tsl'

export class Terrain
{
    constructor()
    {
        this.game = Game.getInstance()

        this.geometry = this.game.resources.terrainModel.scene.children[0].geometry

        // this.setGrid()
        this.setGround()
        // this.setKeys()
        // this.setPhysicalBox()
        this.setPhysicalHeightfield()

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setGround()
    {
        const material = new THREE.MeshLambertNodeMaterial({ color: '#000000', wireframe: false })

        const terrainData = this.game.materials.terrainDataNode(uv())
        const terrainDataGrass = terrainData.g.smoothstep(0.4, 0.6)
        const baseColor = this.game.materials.terrainColorNode(terrainData)
        // const baseColor = vec3(uv(), 1)

        const totalShadow = this.game.materials.getTotalShadow(material).mul(terrainDataGrass.oneMinus())

        material.outputNode = this.game.materials.lightOutputNode(baseColor.rgb, totalShadow)

        this.ground = new THREE.Mesh(this.geometry, material)
        this.ground.receiveShadow = true
        this.game.scene.add(this.ground)

        // // Debug
        // if(this.game.debug.active)
        // {
        //     const debugPanel = this.game.debug.panel.addFolder({
        //         title: '🪴 Ground',
        //         expanded: true,
        //     })

        //     this.game.debug.addThreeColorBinding(debugPanel, grassColorUniform.value, 'grassColor')
        //     this.game.debug.addThreeColorBinding(debugPanel, dirtColorUniform.value, 'dirtColorUniform')
        //     this.game.debug.addThreeColorBinding(debugPanel, waterSurfaceColorUniform.value, 'waterSurfaceColorUniform')
        //     this.game.debug.addThreeColorBinding(debugPanel, waterDepthColorUniform.value, 'waterDepthColorUniform')
        // }
    }

    setKeys()
    {
        // Texture
        // this.game.resources.floorKeysTexture.magFilter = THREE.NearestFilter
        // this.game.resources.floorKeysTexture.minFilter = THREE.NearestFilter

        // Geometry
        const geometry = new THREE.PlaneGeometry(4, 1)

        // Material
        const material = new THREE.MeshBasicNodeMaterial({
            alphaMap: this.game.resources.floorKeysTexture,
            alphaTest: 0.5,
            transparent: true,
        })

        // Mesh
        this.keys = new THREE.Mesh(geometry, material)
        // this.keys.castShadow = true
        // this.keys.receiveShadow = true
        this.keys.scale.setScalar(3)
        this.keys.rotation.x = - Math.PI * 0.5
        this.keys.rotation.z = Math.PI * 0.5
        this.keys.position.y = 1
        this.keys.position.x = 4
        this.game.scene.add(this.keys)
    }

    setGrid()
    {
        const lines = [
            // new MeshGridMaterialLine(0x705df2, 1, 0.03, 0.2),
            // new MeshGridMaterialLine(0xffffff, 10, 0.003, 1),
            new MeshGridMaterialLine(0x423f25, 1, 0.03, 0.2),
            new MeshGridMaterialLine(0x696969, 10, 0.003, 1),
        ]

        const uvGridMaterial = new MeshGridMaterial({
            color: 0x1b191f,
            scale: 0.001,
            antialiased: true,
            reference: 'uv', // uv | world
            side: THREE.DoubleSide,
            lines
        })

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
            uvGridMaterial
        )
        ground.position.y -= 0.02
        ground.rotation.x = - Math.PI * 0.5
        this.game.scene.add(ground)

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '🌐 Grid Floor',
                expanded: false,
            })

            debugPanel.addBinding(uvGridMaterial, 'scale', { min: 0, max: 0.002, step: 0.0001 })

            for(const line of lines)
            {
                const lineDebugPanel = debugPanel.addFolder({
                    title: 'Line',
                    expanded: false,
                })
                lineDebugPanel.addBinding(line.scale, 'value', { label: 'scale', min: 0, max: 1, step: 0.001 })
                lineDebugPanel.addBinding(line.thickness, 'value', { label: 'thickness', min: 0, max: 1, step: 0.001 })
                lineDebugPanel.addBinding(line.offset, 'value', { label: 'offset', min: 0, max: 1, step: 0.001 })
                lineDebugPanel.addBinding(line.cross, 'value', { label: 'cross', min: 0, max: 1, step: 0.001 })
                lineDebugPanel.addBinding({ color: '#' + line.color.value.getHexString(THREE.SRGBColorSpace) }, 'color').on('change', tweak => line.color.value.set(tweak.value))
            }
        }
    }

    setPhysicalBox()
    {
        this.game.entities.add({
            type: 'fixed',
            friction: 0.25,
            restitution: 0,
            colliders: [
                { shape: 'cuboid', parameters: [ 1000, 1, 1000 ], position: { x: 0, y: - 1.01, z: 0 } },
            ]
        })
    }

    setPhysicalHeightfield()
    {
        // Extract heights from geometry
        const positionAttribute = this.geometry.attributes.position
        const totalCount = positionAttribute.count
        const rowsCount = Math.sqrt(totalCount)
        const heights = new Float32Array(totalCount)
        const halfExtent = 256 / 2

        for(let i = 0; i < totalCount; i++)
        {
            const x = positionAttribute.array[i * 3 + 0]
            const y = positionAttribute.array[i * 3 + 1]
            const z = positionAttribute.array[i * 3 + 2]
            const indexX = ((x / (halfExtent * 2)) + 0.5) * (rowsCount - 1)
            const indexZ = ((z / (halfExtent * 2)) + 0.5) * (rowsCount - 1)
            const index = indexZ + indexX * rowsCount

            heights[Math.round(index)] = y
        }

        this.game.entities.add({
            type: 'fixed',
            friction: 0.25,
            restitution: 0,
            colliders: [
                { shape: 'heightfield', parameters: [ rowsCount - 1, rowsCount - 1, heights, { x: 256, y: 1, z: 256 } ] }
            ]
        })
    }

    update()
    {
        // // TODO: Mutualise formula as for grass
        // const offset = new THREE.Vector3(this.game.view.spherical.offset.x, 0, this.game.view.spherical.offset.z).setLength(80 / 2).negate()
        // this.ground.position.set(
        //     this.game.view.position.x,
        //     0,
        //     this.game.view.position.z
        // ).add(offset)
    }
}