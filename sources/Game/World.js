import * as THREE from 'three/webgpu'
import CameraControls from 'camera-controls'
import { Game } from './Game.js'

CameraControls.install( { THREE: THREE } )

export class World
{
    constructor()
    {
        this.game = new Game()

        this.scene = new THREE.Scene()

        this.dummy = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshNormalMaterial()
        )
        this.scene.add(this.dummy)

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 999)
    }

    update()
    {
        this.dummy.rotation.y = this.game.time.elapsed
    }
}