import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { Debug } from './Debug.js'
import { Inputs } from './Inputs.js'
import { Physics } from './Physics/Physics.js'
import { Rendering } from './Rendering.js'
import { Resources } from './Resources.js'
import { Time } from './Time.js'
import { Vehicle } from './Vehicle/Vehicle.js'
import { View } from './View.js'
import { Viewport } from './Viewport.js'
import { World } from './World/World.js'
import { GroundData } from './GroundData/GroundData.js'

export class Game
{
    constructor()
    {
        // Singleton
        if(Game.instance)
            return Game.instance

        Game.instance = this

        // Rapier init
        RAPIER.init().then(() =>
        {
            console.log('init')
            this.init()
        })
    }

    init()
    {
        // Setup
        this.domElement = document.querySelector('.game')

        this.scene = new THREE.Scene()
        // this.scene.fogNode = rangeFog(color(0x1b191f), 20, 100)

        this.debug = new Debug()
        this.time = new Time()
        this.inputs = new Inputs([
            { name: 'forward', keys: [ 'ArrowUp', 'KeyW' ] },
            { name: 'right', keys: [ 'ArrowRight', 'KeyD' ] },
            { name: 'backward', keys: [ 'ArrowDown', 'KeyS' ] },
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
        this.viewport = new Viewport(this.domElement)
        this.resources = new Resources()
        this.physics = new Physics()
        this.groundData = new GroundData()
        this.world = new World()
        this.vehicle = new Vehicle()
        this.view = new View()
        this.rendering = new Rendering()

        if(this.debug.active)
        {
            this.time.events.on('tick', () =>
            {
                this.debug.stats.update()
            })
        }
    }
}

