import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { texture } from 'three/webgpu'
import { vec2 } from 'three/webgpu'
import { Fn } from 'three/webgpu'
import { positionGeometry } from 'three/webgpu'
import { positionLocal } from 'three/webgpu'
import { vec3 } from 'three/webgpu'
import { transformNormalToView } from 'three/webgpu'
import { positionViewDirection } from 'three/webgpu'
import { sin } from 'three/webgpu'
import { positionWorld } from 'three/webgpu'
import { time } from 'three/webgpu'

export class Bush
{
    constructor()
    {
        this.game = new Game()

        this.game.resources.load(
            [
                { path: 'bush/bushLeaves.png', type: 'texture', name: 'bushLeaves' },
                { path: 'bush/bush.glb', type: 'gltf', name: 'bushModel' },
                { path: 'matcaps/bushOnGreen.png', type: 'texture', name: 'matcapBushOnGreen' },
            ],
            (resources) =>
            {
                this.resources = resources
                this.resources.matcapBushOnGreen.colorSpace = THREE.SRGBColorSpace
                this.init()
            }
        )
    }

    init()
    {
        const geometry = this.resources.bushModel.scene.children[0].geometry

        const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
        // const material = new THREE.MeshNormalNodeMaterial({ side: THREE.DoubleSide })
        // const material = new THREE.MeshMatcapNodeMaterial({ side: THREE.DoubleSide, matcap: this.resources.matcapBushOnGreen })

        material.positionNode = Fn(() =>
        {
            const windX = sin(time)
            const windZ = sin(time.mul(1.2))
            const multiplier = positionWorld.y.mul(0.05).mul(sin(time.mul(1.5)).add(1).mul(0.5))
            const windPosition = positionLocal.add(vec3(windX, 0, windZ).mul(multiplier))
            return windPosition
        })()

        material.colorNode = Fn(() =>
        {
            const x = vec3(positionViewDirection.z, 0, positionViewDirection.x.negate()).normalize()
            const y = positionViewDirection.cross(x)

            const cuustomTransformedNormalView = transformNormalToView(positionGeometry.normalize())
            const customMatcapUv = vec2(x.dot(cuustomTransformedNormalView), y.dot(cuustomTransformedNormalView) ).mul(0.495).add(0.5)

            const matcapColor = texture(this.resources.matcapBushOnGreen, customMatcapUv)
            const leavesColor = texture(this.resources.bushLeaves)

            leavesColor.r.lessThan(0.5).discard()

            return matcapColor.rgb
        })()

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(2, 1, 2)
        mesh.scale.setScalar(1.5)
        this.game.world.scene.add(mesh)

        // const testSphere = new THREE.Mesh(
        //     new THREE.IcosahedronGeometry(1, 3),
        //     material
        // )
        // testSphere.position.set(2, 1, - 2)
        // this.game.world.scene.add(testSphere)
    }
}