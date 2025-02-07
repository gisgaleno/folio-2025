import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import MeshGridMaterial, { MeshGridMaterialLine } from '../Materials/MeshGridMaterial.js'
import { Fn, min, positionLocal, positionWorld, uv, vec4 } from 'three/tsl'

export class Field
{
    constructor()
    {
        this.game = Game.getInstance()

        this.geometry = this.game.resources.terrainModel.scene.children[0].geometry
        this.subdivision = this.game.terrainData.subdivision

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌐 Field',
                expanded: false,
            })
        }

        this.setVisual()
        this.setPhysical()
        // this.setKeys()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setVisual()
    {
        this.size = Math.round(this.game.view.optimalArea.radius * 2) + 1
        this.halfSize = this.size * 0.5
        this.subdivisions = this.size

        // Geometry
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.subdivisions, this.subdivisions)
        geometry.rotateX(-Math.PI * 0.5)
        geometry.deleteAttribute('normal')

        // Material
        const material = new THREE.MeshLambertNodeMaterial({ color: '#000000', wireframe: false })

        // Terrain data
        const terrainData = this.game.terrainData.terrainDataNode(positionWorld.xz)
        const terrainDataGrass = terrainData.g.smoothstep(0.4, 0.6)
        const baseColor = this.game.terrainData.colorNode(terrainData)

        // Displacement
        material.positionNode = Fn(() =>
        {
            const uvDim = min(min(uv().x, uv().y).mul(20), 1)

            const newPosition = positionLocal.toVar()
            newPosition.y.addAssign(terrainData.b.mul(-2).mul(uvDim))


            return newPosition
        })()

        // Output
        const totalShadow = this.game.lighting.addTotalShadowToMaterial(material).mul(terrainDataGrass.oneMinus())
        material.outputNode = this.game.lighting.lightOutputNodeBuilder(baseColor.rgb, totalShadow, false, false)

        // Mesh
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
        // this.mesh.castShadow = true
        this.game.scene.add(this.mesh)
    }

    setKeys()
    {
        // Geometry
        const geometry = new THREE.PlaneGeometry(4, 1)

        // Material
        const material = new THREE.MeshBasicNodeMaterial({
            alphaMap: this.game.resources.floorKeysTexture,
            alphaTest: 0.5
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

    setPhysical()
    {
        // Extract heights from geometry
        const positionAttribute = this.geometry.attributes.position
        const totalCount = positionAttribute.count
        const rowsCount = Math.sqrt(totalCount)
        const heights = new Float32Array(totalCount)
        const halfExtent = this.subdivision / 2

        for(let i = 0; i < totalCount; i++)
        {
            const x = positionAttribute.array[i * 3 + 0]
            const y = positionAttribute.array[i * 3 + 1]
            const z = positionAttribute.array[i * 3 + 2]
            const indexX = Math.round(((x / (halfExtent * 2)) + 0.5) * (rowsCount - 1))
            const indexZ = Math.round(((z / (halfExtent * 2)) + 0.5) * (rowsCount - 1))
            const index = indexZ + indexX * rowsCount

            heights[index] = y
        }

        this.game.entities.add({
            type: 'fixed',
            friction: 0.25,
            restitution: 0,
            colliders: [
                { shape: 'heightfield', parameters: [ rowsCount - 1, rowsCount - 1, heights, { x: this.subdivision, y: 1, z: this.subdivision } ], category: 'floor' }
            ]
        })
    }

    update()
    {
        this.mesh.position.x = Math.round(this.game.view.optimalArea.position.x)
        this.mesh.position.z = Math.round(this.game.view.optimalArea.position.z)
    }
}