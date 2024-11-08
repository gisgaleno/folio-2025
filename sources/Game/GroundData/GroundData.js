import * as THREE from 'three'
import { Game } from '../Game.js'
import { Track } from './Track.js'
import { vec3, vec2, viewportSize, Fn, vec4, attribute } from 'three'

export class GroundData
{
    constructor()
    {
        this.game = new Game()

        this.resolution = 512
        this.size = 30
        this.halfSize = this.size / 2
        this.tracks = []

        this.focusPoint = new THREE.Vector2()
        
        this.camera = new THREE.OrthographicCamera(- this.halfSize,  this.halfSize,  this.halfSize, - this.halfSize, 0.1, 10)
        this.camera.position.y = 5
        this.camera.rotation.x = - Math.PI * 0.5
        
        this.scene = new THREE.Scene()
        this.scene.add(this.camera)

        this.renderTarget = new THREE.RenderTarget(
            this.resolution,
            this.resolution,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                wrapS: THREE.ClampToEdgeWrapping,
                wrapT: THREE.ClampToEdgeWrapping
            }
        )

        // this.setDebugPlane()

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 5)
    }

    setDebugPlane()
    {
        const material = new THREE.MeshBasicNodeMaterial({ map: this.renderTarget.texture, transparent: false, depthTest: false, depthWrite: false })
        material.vertexNode = Fn(() =>
        {
            const ratio = viewportSize.x.div(viewportSize.y)
            const position = attribute('position').mul(vec3(1, ratio, 0)).mul(0.5).sub(vec3(0.75, 0.5, 0))
            return vec4(position, 1)
        })()
     
        const geometry = new THREE.PlaneGeometry(1, 1)   
        const mesh = new THREE.Mesh(geometry, material)
        
        mesh.position.y = 5
        mesh.position.x = - 3
        mesh.frustumCulled = false
        mesh.renderOrder = 1
        this.game.scene.add(mesh)
    }

    createTrack()
    {
        const track = new Track()
        this.tracks.push(track)
        this.scene.add(track.trail.mesh)
        return track
    }

    update()
    {
        this.camera.position.x = this.focusPoint.x
        this.camera.position.z = this.focusPoint.y

        // Render
        const clearAlpha = this.game.rendering.renderer.getClearAlpha()
        
        this.game.rendering.renderer.setClearAlpha(0)
        this.game.rendering.renderer.setRenderTarget(this.renderTarget)

        this.game.rendering.renderer.renderAsync(this.scene, this.camera)

        this.game.rendering.renderer.setRenderTarget(null)
        this.game.rendering.renderer.setClearAlpha(clearAlpha)
    }
}