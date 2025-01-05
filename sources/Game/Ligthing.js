import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { uniform, color } from 'three/tsl'

export class Lighting
{
    constructor()
    {
        this.game = Game.getInstance()

        this.useCycles = true
        this.phi = 0.73
        this.theta = 0.72
        this.phiAmplitude = 0.82
        this.thetaAmplitude = 1
        this.spherical = new THREE.Spherical(25, this.phi, this.theta)
        this.direction = new THREE.Vector3().setFromSpherical(this.spherical).normalize()
        this.directionUniform = uniform(this.direction)
        this.colorUniform = uniform(color('#ffffff'))
        this.intensityUniform = uniform(1)
        this.count = 1
        this.lights = []
        this.mapSizeMin = 1024
        this.shadowAmplitude = 20
        this.near = 1
        this.depth = 60
        this.shadowBias = 0
        this.shadowNormalBias = 0

        this.setLights()
        this.setHelper()
        this.updateShadow()

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 7)

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '💡 Lighting',
                expanded: false,
            })

            debugPanel.addBinding(this.helper, 'visible', { label: 'helperVisible' })
            debugPanel.addBinding(this, 'useCycles')
            debugPanel.addBinding(this, 'phi', { min: 0, max: Math.PI * 0.5 }).on('change', () => this.updateCoordinates())
            debugPanel.addBinding(this, 'theta', { min: - Math.PI, max: Math.PI }).on('change', () => this.updateCoordinates())
            debugPanel.addBinding(this, 'phiAmplitude', { min: 0, max: Math.PI}).on('change', () => this.updateCoordinates())
            debugPanel.addBinding(this, 'thetaAmplitude', { min: - Math.PI, max: Math.PI }).on('change', () => this.updateCoordinates())
            debugPanel.addBinding(this.spherical, 'radius', { min: 0, max: 100 }).on('change', () => this.updateCoordinates())
            debugPanel.addBlade({ view: 'separator' })
            debugPanel.addBinding(this, 'near', { min: 0.1, max: 50, step: 0.1 }).on('change', () => this.updateShadow())
            debugPanel.addBinding(this, 'depth', { min: 0.1, max: 100, step: 0.1 }).on('change', () => this.updateShadow())
            debugPanel.addBinding(this, 'shadowAmplitude', { min: 1, max: 50 }).on('change', () => this.updateShadow())
            debugPanel.addBinding(this, 'shadowBias', { min: -0.1, max: 0.1 }).on('change', () => this.updateShadow())
            debugPanel.addBinding(this, 'shadowNormalBias', { min: -0.1, max: 0.1 }).on('change', () => this.updateShadow())

            const mapSizes = {}
            for(let i = 0; i < 12; i++)
            {
                const size = Math.pow(2, i + 1)
                mapSizes[size] = size
            }
            debugPanel.addBinding(this, 'mapSizeMin', { options: mapSizes }).on('change', () => this.updateShadow())
        }
    }

    setLights()
    {
        for(let i = 0; i < this.count; i++)
        {
            const light = new THREE.DirectionalLight(0xffffff, 5)
            light.position.setFromSpherical(this.spherical)
            light.castShadow = true
            
            this.game.scene.add(light)
            this.game.scene.add(light.target)

            this.lights.push(light)
        }
    }

    setHelper()
    {
        this.helper = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.25, 1),
            new THREE.MeshBasicNodeMaterial({ wireframe: true })
        )
        this.helper.visible = false

        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 5),
        ]
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        this.helper.add(line)

        this.game.scene.add(this.helper)
    }

    updateShadow()
    {
        let i = 0
        for(const light of this.lights)
        {
            light.shadow.camera.top = this.shadowAmplitude
            light.shadow.camera.right = this.shadowAmplitude
            light.shadow.camera.bottom = - this.shadowAmplitude
            light.shadow.camera.left = - this.shadowAmplitude
            light.shadow.camera.near = this.near
            light.shadow.camera.far = this.near + this.depth
            light.shadow.bias = this.shadowBias
            light.shadow.normalBias = this.shadowNormalBias

            light.shadow.camera.updateProjectionMatrix()

            const mapSize = this.mapSizeMin * Math.pow(2, i)
            light.shadow.mapSize.set(mapSize, mapSize)

            i++
        }
    }

    updateCoordinates()
    {
        this.direction.setFromSpherical(this.spherical).normalize()
    }

    update()
    {
        if(this.useCycles)
        {
            this.spherical.theta = this.theta + Math.sin(- (this.game.cycles.day.progress + 9/16) * Math.PI * 2) * this.thetaAmplitude
            this.spherical.phi = this.phi + (Math.cos(- (this.game.cycles.day.progress + 9/16) * Math.PI * 2) * 0.5) * this.phiAmplitude
        }
        else
        {
            this.spherical.theta = this.theta
            this.spherical.phi = this.phi
        }
        this.direction.setFromSpherical(this.spherical).normalize()
        
        // Offset (TODO: optimise)
        const offset = new THREE.Vector3(0, 0, -5)

        for(const light of this.lights)
        {

            light.position.setFromSpherical(this.spherical).add(this.game.view.focusPoint.position).add(offset)
            light.target.position.copy(this.game.view.focusPoint.position).add(offset)
        }

        // Helper
        this.helper.position.copy(this.direction).multiplyScalar(5).add(this.game.view.focusPoint.position)
        this.helper.lookAt(this.game.view.focusPoint.position)

        // Apply day cycles values
        this.colorUniform.value.copy(this.game.cycles.day.values.properties.lightColor.value)
        this.intensityUniform.value = this.game.cycles.day.values.properties.lightIntensity.value
    }
}