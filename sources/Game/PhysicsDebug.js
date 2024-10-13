import { Game } from './Game.js'
import * as THREE from 'three/webgpu'

export class PhysicsDebug
{
    constructor()
    {
        this.game = new Game()

        // this.geometry = new THREE.BoxGeometry(1, 1, 1)
        this.geometry = new THREE.BufferGeometry()
        const positions = new Float32Array([
            0, 0, 0, 0, 2, 0,
            2, 0, 0, 2, 2, 0,
        ])
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(positions, 4))


        this.material = new THREE.LineBasicMaterial({ vertexColors: true })
        this.mesh = new THREE.LineSegments(this.geometry, this.material)
        this.game.world.scene.add(this.mesh)

        this.game.time.events.on('tick', () =>
        {
            this.update()
        })
    }
    update()
    {
        const { vertices, colors } = this.game.physics.world.debugRender()
        // console.log(this.game.physics.world.debugRender())

        this.geometry.attributes.position.array = vertices
        this.geometry.attributes.position.count = vertices.length / 3
        this.geometry.attributes.position.needsUpdate = true

        this.geometry.attributes.color.array = colors
        this.geometry.attributes.color.count = colors.length / 4
        this.geometry.attributes.color.needsUpdate = true
    }
}