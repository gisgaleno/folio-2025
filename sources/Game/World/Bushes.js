import * as THREE from 'three'
import { Game } from '../Game.js'
import getWind from '../tsl/getWind.js'
import { color, uniform, normalLocal, mix, output, instance, smoothstep, vec4, PI, vertexIndex, rotateUV, time, sin, uv, texture, float, Fn, positionLocal, vec3, transformNormalToView, normalWorld, positionWorld, frontFacing, If } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { remap } from '../utilities/maths.js'

export class Bushes
{
    constructor()
    {
        this.game = new Game()

        this.items = this.getFromModel()
        // this.items = this.getOne()
        // this.items = this.getRandomClusters()
        // this.items = this.getGrid()
        
        this.setGeometry()
        this.setMaterial()
        this.setInstancedMesh()
    }

    getFromModel()
    {
        const towardCamera = this.game.view.spherical.offset.clone().normalize()
        const items = []

        for(const _child of this.game.resources.bushes.scene.children)
        {
            const size = _child.scale.x

            const object = new THREE.Object3D()
            
            const angle = Math.PI * 2 * Math.random()
            object.up.set(Math.sin(angle), Math.cos(angle), 0)
            object.lookAt(towardCamera)

            object.position.copy(_child.position)

            object.scale.setScalar(size)
            object.updateMatrix()

            items.push(object.matrix)
        }

        return items
    }
    
    getOne()
    {
        const towardCamera = this.game.view.spherical.offset.clone().normalize()
        const items = []
        const object = new THREE.Object3D()
        object.lookAt(towardCamera)
        object.position.z = -4
        object.updateMatrix()

        items.push(object.matrix)

        return items
    }

    getRandomClusters()
    {
        const towardCamera = this.game.view.spherical.offset.clone().normalize()
        const items = []

        for(let i = 0; i < 80; i++)
        {
            const clusterPosition = new THREE.Vector2(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50
            )

            const clusterCount = 3 + Math.floor(Math.random() * 5)
            for(let j = 3; j < clusterCount; j++)
            {
                const size = remap(Math.random(), 0, 1, 0.5, 1.25)

                const object = new THREE.Object3D()
                
                const angle = Math.PI * 2 * Math.random()
                object.up.set(Math.sin(angle), Math.cos(angle), 0)
                object.lookAt(towardCamera)

                object.position.set(
                    clusterPosition.x + (Math.random() - 0.5) * 3,
                    size * 0.5,
                    clusterPosition.y + (Math.random() - 0.5) * 3
                )

                object.scale.setScalar(size)
                object.updateMatrix()

                items.push(object.matrix)
            }
        }

        return items
    }

    getGrid()
    {
        const towardCamera = this.game.view.spherical.offset.clone().normalize()
        const items = []
        const subdivisions = 100
        for(let i = 0; i < subdivisions; i++)
        {
            for(let j = 0; j < subdivisions; j++)
            {
                const x = ((i / subdivisions) - 0.5) * subdivisions * 10
                const z = ((j / subdivisions) - 0.5) * subdivisions * 10

                const object = new THREE.Object3D()
                
                const angle = Math.PI * 2 * Math.random()
                object.up.set(Math.sin(angle), Math.cos(angle), 0)
                object.lookAt(towardCamera)

                object.position.set(x, 0.25, z)

                object.updateMatrix()

                items.push(object.matrix)
            }
        }

        return items
    }

    setGeometry()
    {
        const count = 80
        const planes = []

        for(let i = 0; i < count; i++)
        {
            const plane = new THREE.PlaneGeometry(0.8, 0.8)

            // Position
            const spherical = new THREE.Spherical(
                1 - Math.pow(Math.random(), 3),
                Math.PI * 2 * Math.random(),
                Math.PI * Math.random()
            )
            const position = new THREE.Vector3().setFromSpherical(spherical)

            plane.rotateZ(Math.random() * 9999)
            plane.rotateY(0)
            plane.translate(
                position.x,
                position.y,
                position.z
            )

            // Normal
            const normal = position.clone().normalize()
            const normalArray = new Float32Array(12)
            for(let i = 0; i < 4; i++)
            {
                const i3 = i * 3

                const position = new THREE.Vector3(
                    plane.attributes.position.array[i3    ],
                    plane.attributes.position.array[i3 + 1],
                    plane.attributes.position.array[i3 + 2],
                )

                const mixedNormal = position.lerp(normal, 0.75)
                
                normalArray[i3    ] = mixedNormal.x
                normalArray[i3 + 1] = mixedNormal.y
                normalArray[i3 + 2] = mixedNormal.z
            }
            
            plane.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3))

            // Save
            planes.push(plane)
        }

        // Merge all planes
        this.geometry = mergeGeometries(planes)
    }

    setMaterial()
    {
        this.material = new THREE.MeshLambertNodeMaterial({
            alphaMap: this.game.resources.bushesLeaves,
            alphaTest: 0.01
        })
    
        // Position
        const wind = getWind([this.game.resources.noisesTexture, positionLocal.xz])
        const multiplier = positionLocal.y.clamp(0, 1).mul(1)

        const normalTest = vec3().toVar()

        this.material.positionNode = Fn( ( { object } ) =>
        {
            instance(object.count, this.instanceMatrix).append()
            normalTest.assign(normalLocal)

            return positionLocal.add(vec3(wind.x, 0, wind.y).mul(multiplier))
        })()

        // Received shadow position
        const shadowOffset = uniform(1)
        this.material.shadowPositionNode = positionLocal.add(this.game.lighting.directionUniform.mul(shadowOffset))

        // Shadow receive
        const totalShadows = this.game.materials.getTotalShadow(this.material)

        // Output
        const baseColor = uniform(color('#9eaf33').rgb)

        this.material.outputNode = this.game.materials.lightOutputNode(baseColor, totalShadows)

        // Bushes
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '🌳 Bushes',
                expanded: false,
            })

            debugPanel.addBinding({ color: baseColor.value.getHex(THREE.SRGBColorSpace) }, 'color', { label: 'baseColor', view: 'color' })
                .on('change', tweak => { baseColor.value.set(tweak.value) })
            debugPanel.addBinding(shadowOffset, 'value', { label: 'shadowOffset', min: 0, max: 2, step: 0.001 })
        }
    }

    setInstancedMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.receiveShadow = true
        this.mesh.castShadow = true
        this.mesh.count = this.items.length
        this.mesh.frustumCulled = false
        this.game.scene.add(this.mesh)

        this.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(this.mesh.count * 16), 16)
        this.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        
        let i = 0
        for(const _item of this.items)
        {
            _item.toArray(this.instanceMatrix.array, i * 16)
            i++
        }
    }
}