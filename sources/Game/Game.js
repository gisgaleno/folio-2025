import { Debug } from './Debug.js'
import { Inputs } from './Inputs.js'
import { Physics } from './Physics/Physics.js'
import { PhysicsDebug } from './Physics/PhysicsDebug.js'
import { Rendering } from './Rendering.js'
import { Time } from './Time.js'
import { Vehicle } from './Vehicle.js'
import { View } from './View.js'
import { Viewport } from './Viewport.js'
import { World } from './World.js'

export class Game
{
    constructor()
    {
        // Singleton
        if(Game._instance)
            return Game._instance

        Game._instance = this

        // Setup
        this.domElement = document.querySelector('.game')

        this.debug = new Debug()
        this.inputs = new Inputs([
            { name: 'up', keys: [ 'ArrowUp', 'KeyW' ] },
            { name: 'right', keys: [ 'ArrowRight', 'KeyD' ] },
            { name: 'down', keys: [ 'ArrowDown', 'KeyS' ] },
            { name: 'left', keys: [ 'ArrowLeft', 'KeyA' ] },
            { name: 'boost', keys: [ 'ShiftLeft', 'ShiftRight' ] },
            { name: 'brake', keys: [ 'KeyB' ] },
            { name: 'reset', keys: [ 'KeyR' ] },
            { name: 'hydraulics', keys: [ 'Numpad5', 'Space' ] },
            { name: 'hydraulicsFront', keys: [ 'Numpad8' ] },
            { name: 'hydraulicsBack', keys: [ 'Numpad2' ] },
            { name: 'hydraulicsRight', keys: [ 'Numpad6' ] },
            { name: 'hydraulicsLeft', keys: [ 'Numpad4' ] },
            { name: 'hydraulicsFrontLeft', keys: [ 'Numpad7' ] },
            { name: 'hydraulicsFrontRight', keys: [ 'Numpad9' ] },
            { name: 'hydraulicsBackRight', keys: [ 'Numpad3' ] },
            { name: 'hydraulicsBackLeft', keys: [ 'Numpad1' ] },
        ])
        this.time = new Time()
        this.viewport = new Viewport(this.domElement)
        this.physics = new Physics()
        this.world = new World()
        this.physicsDebug = new PhysicsDebug()
        this.view = new View()
        this.rendering = new Rendering()
        this.vehicle = new Vehicle()
    }
}

