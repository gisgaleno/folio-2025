import * as THREE from 'three/webgpu'
import CameraControls from 'camera-controls'
import { Game } from './Game.js'

CameraControls.install( { THREE: THREE } )

export class View
{
    constructor()
    {
        this.game = new Game()

        this.camera = new THREE.PerspectiveCamera(25, this.game.viewport.ratio, 0.1, 1000)
        this.camera.position.set(2, 3, 4)
        this.game.world.scene.add(this.camera)

        this.cameraControls = new CameraControls(this.camera, this.game.domElement)

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 0)

        this.game.viewport.events.on('change', () =>
        {
            this.resize()
        })
    }

    resize()
    {
        this.camera.aspect = this.game.viewport.width / this.game.viewport.height
        this.camera.updateProjectionMatrix()
    }

    update()
    {
        this.cameraControls.update(this.game.time.delta)
    }
}