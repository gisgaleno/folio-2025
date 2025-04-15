import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three/webgpu'

import { Debug } from './Debug.js'
import { Inputs } from './Inputs.js'
import { Physics } from './Physics/Physics.js'
import { Rendering } from './Rendering.js'
import { ResourcesLoader } from './ResourcesLoader.js'
import { Ticker } from './Ticker.js'
import { Time } from './Time.js'
import { Player } from './Player.js'
import { View } from './View.js'
import { Viewport } from './Viewport.js'
import { World } from './World/World.js'
import { GroundData } from './GroundData/GroundData.js'
import { Monitoring } from './Monitoring.js'
import { Lighting } from './Ligthing.js'
import { Materials } from './Materials.js'
import { Entities } from './Entities.js'
import { Fog } from './Fog.js'
import { DayCycles } from './Cycles/DayCycles.js'
import { Weather } from './Weather.js'
import { Noises } from './Noises.js'
import { Wind } from './Wind.js'
import { TerrainData } from './TerrainData.js'
import { Explosions } from './Explosions.js'
import { YearCycles } from './Cycles/YearCycles.js'
import { Server } from './Server.js'
import { Modals } from './Modals.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { PhysicsWireframe } from './Physics/PhysicsWireframe.js'
import { Areas } from './Areas.js'
import { Overlay } from './Overlay.js'
import { Tornado } from './Tornado.js'
import { InteractiveAreas } from './InteractiveAreas2.js'
import { Respawns } from './Respawns.js'
import { Audio } from './Audio.js'

export class Game
{
    static getInstance()
    {
        return Game.instance
    }

    constructor()
    {
        // Singleton
        if(Game.instance)
            return Game.instance

        Game.instance = this
        console.log('init')

        // Rapier init
        RAPIER.init().then(() =>
        {
            console.log('initiated')
            console.log(RAPIER)

            // Load resources
            this.resourcesLoader = new ResourcesLoader()
            this.resourcesLoader.load(
                [
                    [ 'foliateTexture',                 'foliage/foliage.png',                          'texture' ],
                    [ 'bushesReferences',               'bushes/bushesReferences.glb',                  'gltf'    ],
                    // [ 'vehicle',                        'vehicle/default.glb',                          'gltf'    ],
                    [ 'vehicle',                        'vehicle/defaultAntenna.glb',                   'gltf'    ],
                    [ 'playgroundVisual',               'playground/playgroundVisual.glb',              'gltf'    ],
                    [ 'playgroundPhysical',             'playground/playgroundPhysical.glb',            'gltf'    ],
                    [ 'floorKeysTexture',               'floor/keys.png',                               'texture' ],
                    [ 'flowersReferencesModel',         'flowers/flowersReferences.glb',                'gltf'    ],
                    [ 'bricksReferencesModel',          'bricks/bricksReferences.glb',                  'gltf'    ],
                    [ 'bricksVisualModel',              'bricks/bricksVisual.glb',                      'gltf'    ],
                    [ 'terrainTexture',                 'terrain/terrain.png',                          'texture' ],
                    // [ 'terrainTexture',                 'terrain/flatGrass.png',                        'texture' ],
                    [ 'terrainModel',                   'terrain/terrain.glb',                          'gltf'    ],
                    [ 'birchTreesVisualModel',          'birchTrees/birchTreesVisual.glb',              'gltf'    ],
                    [ 'birchTreesReferencesModel',      'birchTrees/birchTreesReferences.glb',          'gltf'    ],
                    [ 'oakTreesVisualModel',            'oakTrees/oakTreesVisual.glb',                  'gltf'    ],
                    [ 'oakTreesReferencesModel',        'oakTrees/oakTreesReferences.glb',              'gltf'    ],
                    [ 'cherryTreesVisualModel',         'cherryTrees/cherryTreesVisual.glb',            'gltf'    ],
                    [ 'cherryTreesReferencesModel',     'cherryTrees/cherryTreesReferences.glb',        'gltf'    ],
                    [ 'sceneryStaticModel',             'scenery/sceneryStatic.glb',                    'gltf'    ],
                    [ 'sceneryDynamicModel',            'scenery/sceneryDynamic.glb',                   'gltf'    ],
                    [ 'poleLightsVisualModel',          'poleLights/poleLightsVisual.glb',              'gltf'    ],
                    [ 'poleLightsPhysicalModel',        'poleLights/poleLightsPhysical.glb',            'gltf'    ],
                    [ 'whisperBeamTexture',             'whispers/whisperBeam.png',                     'texture' ],
                    [ 'satanStarTexture',               'scenery/satanStar.png',                        'texture' ],
                    [ 'tornadoPathModel',               'tornado/tornadoPath.glb',                      'gltf'    ],
                    [ 'overlayPatternTexture',          'overlay/overlayPattern.png',                   'texture', (resource) => { resource.wrapS = THREE.RepeatWrapping; resource.wrapT = THREE.RepeatWrapping } ],
                    [ 'cookieBannerTexture',            'cookieStand/cookieBanner.png',                 'texture', (resource) => { resource.colorSpace = THREE.SRGBColorSpace; resource.flipY = false } ],
                    [ 'interactiveAreasKeyIconTexture', 'interactiveAreas/interactiveAreasKeyIcon.png', 'texture', (resource) => { resource.flipY = true; resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false } ],
                    [ 'respawnsModel',                  'respawns/respawns.glb',                        'gltf'    ],
                    [ 'easterEggVisualModel',           'easter/easterEggVisual.glb',                   'gltf'    ],
                    [ 'easterEggReferencesModel',       'easter/easterEggReferences.glb',               'gltf'    ],
                    
                    // [ 'christmasTreeVisualModel',     'christmas/christmasTreeVisual.glb',     'gltf' ],
                    // [ 'christmasTreePhysicalModel',   'christmas/christmasTreePhysical.glb',   'gltf' ],
                    // [ 'christmasGiftVisualModel',     'christmas/christmasGiftVisual.glb',     'gltf' ],
                    // [ 'christmasGiftReferencesModel', 'christmas/christmasGiftReferences.glb', 'gltf' ],
                ],
                (resources) =>
                {
                    console.log('loaded')
                    this.resources = resources

                    this.resources.terrainTexture.flipY = false

                    // Init
                    this.init()
                }
            )
        })
    }

    init()
    {
        // Setup
        this.domElement = document.querySelector('.game')

        this.scene = new THREE.Scene()

        this.server = new Server()
        this.ticker = new Ticker()
        this.inputs = new Inputs([
            // Vehicle
            { name: 'forward',               categories: [ 'playing' ], keys: [ 'ArrowUp', 'KeyW' ] },
            { name: 'right',                 categories: [ 'playing' ], keys: [ 'ArrowRight', 'KeyD' ] },
            { name: 'backward',              categories: [ 'playing' ], keys: [ 'ArrowDown', 'KeyS' ] },
            { name: 'left',                  categories: [ 'playing' ], keys: [ 'ArrowLeft', 'KeyA' ] },
            { name: 'boost',                 categories: [ 'playing' ], keys: [ 'ShiftLeft', 'ShiftRight' ] },
            { name: 'brake',                 categories: [ 'playing' ], keys: [ 'KeyB' ] },
            { name: 'respawn',               categories: [ 'playing' ], keys: [ 'KeyR' ] },
            { name: 'suspensions',           categories: [ 'playing' ], keys: [ 'Numpad5', 'Space' ] },
            { name: 'suspensionsFront',      categories: [ 'playing' ], keys: [ 'Numpad8' ] },
            { name: 'suspensionsBack',       categories: [ 'playing' ], keys: [ 'Numpad2' ] },
            { name: 'suspensionsRight',      categories: [ 'playing' ], keys: [ 'Numpad6' ] },
            { name: 'suspensionsLeft',       categories: [ 'playing' ], keys: [ 'Numpad4' ] },
            { name: 'suspensionsFrontLeft',  categories: [ 'playing' ], keys: [ 'Numpad7' ] },
            { name: 'suspensionsFrontRight', categories: [ 'playing' ], keys: [ 'Numpad9' ] },
            { name: 'suspensionsBackRight',  categories: [ 'playing' ], keys: [ 'Numpad3' ] },
            { name: 'suspensionsBackLeft',   categories: [ 'playing' ], keys: [ 'Numpad1' ] },
            { name: 'whisper',               categories: [ 'playing' ], keys: [ 'KeyT' ] },
            { name: 'interact',              categories: [ 'playing' ], keys: [ 'Enter' ] },

            // UI
            { name: 'close',                 categories: [ 'ui', 'playing' ], keys: [ 'Escape' ] },

            // Debug
            { name: 'viewToggle',            categories: [ 'debug' ], keys: [ 'KeyV' ] },
            { name: 'debugToggle',           categories: [ 'debug' ], keys: [ 'KeyH' ] },
        ])
        this.debug = new Debug()
        this.time = new Time()
        this.viewport = new Viewport(this.domElement)
        this.modals = new Modals()
        this.view = new View()
        this.rendering = new Rendering(() =>
        {
            this.noises = new Noises()
            this.audio = new Audio()
            this.dayCycles = new DayCycles()
            this.yearCycles = new YearCycles()
            this.weather = new Weather()
            this.wind = new Wind()
            this.groundData = new GroundData()
            this.terrainData = new TerrainData()
            this.lighting = new Lighting()
            this.fog = new Fog()
            this.materials = new Materials()
            this.entities = new Entities()
            this.explosions = new Explosions()
            this.tornado = new Tornado()
            this.physics = new Physics()
            this.wireframe = new PhysicsWireframe()
            this.physicalVehicle = new PhysicsVehicle()
            this.areas = new Areas()
            this.respawns = new Respawns()
            this.player = new Player()
            this.interactiveAreas = new InteractiveAreas()
            this.world = new World()
            this.overlay = new Overlay()
            // this.monitoring = new Monitoring()

            this.rendering.renderer.setAnimationLoop((elapsedTime) => { this.ticker.update(elapsedTime) })
        })
    }
}

