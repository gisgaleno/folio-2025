import { Physics } from './Physics.js'
import { PhysicsDebug } from './PhysicsDebug.js'
import { Rendering } from './Rendering.js'
import { Time } from './Time.js'
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

        this.time = new Time()
        this.viewport = new Viewport(this.domElement)
        this.physics = new Physics()
        this.world = new World()
        this.view = new View()
        this.rendering = new Rendering()
        this.physicsDebug = new PhysicsDebug()
    }
}

