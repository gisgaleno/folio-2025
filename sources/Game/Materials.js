import * as THREE from 'three/webgpu'
import { positionLocal, varying, uv, max, positionWorld, float, Fn, uniform, color, mix, vec3, vec4, normalWorld, texture, vec2, time, smoothstep } from 'three/tsl'
import { Game } from './Game.js'

export class Materials
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = new Map()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🎨 Materials',
                expanded: false,
            })
        }

        this.setLuminance()
        this.setPreviews()

        this.createEmissiveGradient('emissiveGradientWarm', '#ff8641', '#ff3e00', 6, this.debugPanel.addFolder({ title: 'emissiveGradientWarm' }))
        this.createGradient('carRed', '#ff3a3a', '#721551', this.debugPanel.addFolder({ title: 'carRed' }))
        this.createEmissive('emissiveOrange', '#ff3e00', 3, this.debugPanel.addFolder({ title: 'emissiveOrange' }))
        this.createEmissive('emissiveRed', '#ff3131', 3, this.debugPanel.addFolder({ title: 'emissiveRed' }))
    }

    setLuminance()
    {
        this.luminance = {}
        this.luminance.coefficients = new THREE.Vector3()
        THREE.ColorManagement.getLuminanceCoefficients(this.luminance.coefficients)

        this.luminance.get = (color) =>
        {
            return color.r * this.luminance.coefficients.x + color.g * this.luminance.coefficients.y + color.b * this.luminance.coefficients.z
        }
    }

    // Create materials functions
    createEmissive(_name = 'material', _color = '#ffffff', _intensity = 3, debugPanel = null)
    {
        const baseColor = uniform(color(_color))
        const intensity = uniform(_intensity)

        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        material.fog = false
        this.save(_name, material)
  
        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, baseColor.value, 'color')
            debugPanel.addBinding(intensity, 'value', { min: 0, max: 10, step: 0.01 })
        }

        return material
    }

    createEmissiveGradient(_name = 'material', _colorA = '#ffffff', _colorB = '#ff0000', _intensity = 3, debugPanel = null)
    {
        const colorA = uniform(color(_colorA))
        const colorB = uniform(color(_colorB))
        const intensity = uniform(_intensity)

        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        material.colorNode = mix(colorA, colorB, uv().sub(0.5).length().mul(2)).mul(intensity)
        material.fog = false
        this.save(_name, material)

        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
            this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
            debugPanel.addBinding(intensity, 'value', { min: 0, max: 10, step: 0.01 })
        }
        
        // const update = () =>
        // {
        //     material.color.set(dummy.color)
        //     material.color.multiplyScalar(dummy.intensity / this.luminance.get(material.color))
        // }

        // update()

        // if(this.game.debug.active && debugPanel)
        // {
        //     debugPanel.addBinding(dummy, 'intensity', { min: 0, max: 10, step: 0.01 }).on('change', update)
        //     debugPanel.addBinding(dummy, 'color', { view: 'color' }).on('change', update)
        // }

        return material
    }

    createGradient(_name = 'material', _colorA = 'red', _colorB = 'blue', debugPanel = null)
    {
        const material = new THREE.MeshLambertNodeMaterial()
        material.shadowSide = THREE.BackSide
        
        const colorA = uniform(new THREE.Color(_colorA))
        const colorB = uniform(new THREE.Color(_colorB))
        const baseColor = mix(colorA, colorB, uv().y)
        material.outputNode = this.game.lighting.lightOutputNodeBuilder(baseColor, normalWorld, this.game.lighting.addTotalShadowToMaterial(material))
        
        this.save(_name, material)

        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
            this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
        }

        return material
    }

    setPreviews()
    {
        this.previews = {}
        this.previews.list = new Map()
        this.previews.sphereGeometry = new THREE.IcosahedronGeometry(1, 3)
        this.previews.boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
        this.previews.group = new THREE.Group()
        this.previews.group.visible = false
        this.game.scene.add(this.previews.group)
        
        this.previews.update = () =>
        {
            this.list.forEach((material, name) =>
            {
                if(!this.previews.list.has(name))
                {
                    const test = {}

                    // Pure
                    const pureColor = material.color.clone()
                    const maxLength = Math.max(pureColor.r, Math.max(pureColor.g, pureColor.b))
                    if(maxLength > 1)
                        pureColor.set(pureColor.r / maxLength, pureColor.g / maxLength, pureColor.b / maxLength)
                    
                    const boxPure = new THREE.Mesh(this.previews.boxGeometry, new THREE.MeshBasicMaterial({ color: pureColor }))
                    boxPure.position.y = 0.75
                    boxPure.position.x = this.list.size * 3
                    boxPure.position.z = 0
                    boxPure.castShadow = true
                    boxPure.receiveShadow = true
                    this.previews.group.add(boxPure)
                
                    // Box
                    const box = new THREE.Mesh(this.previews.boxGeometry, material)
                    box.position.y = 0.75
                    box.position.x = this.list.size * 3
                    box.position.z = 3
                    box.castShadow = true
                    box.receiveShadow = true
                    this.previews.group.add(box)

                    // Sphere
                    const sphere = new THREE.Mesh(this.previews.sphereGeometry, material)
                    sphere.position.z = 6
                    sphere.position.y = 0.75
                    sphere.position.x = this.list.size * 3
                    sphere.castShadow = true
                    sphere.receiveShadow = true
                    this.previews.group.add(sphere)

                    this.previews.list.set(name, test)
                }
            })
        }
        
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this.previews.group, 'visible', { label: 'previewsVisibile' })
        }
    }

    save(name, material)
    {
        this.list.set(name, material)
        this.previews.update()
    }

    getFromName(name, baseMaterial)
    {
        // Return existing material
        if(this.list.has(name))
            return this.list.get(name)

        // Create new
        const material = this.createFromMaterial(baseMaterial)

        // Save
        this.save(name, material)
        return material
    }

    createFromMaterial(baseMaterial)
    {
        let material = baseMaterial

        if(baseMaterial.isMeshStandardMaterial)
        {
            material = new THREE.MeshLambertNodeMaterial()
            this.copy(baseMaterial, material)
        }
        
        if(material.isMeshLambertNodeMaterial)
        {
            // Shadow
            material.shadowSide = THREE.BackSide
            material.outputNode = this.game.lighting.lightOutputNodeBuilder(baseMaterial.color, normalWorld, this.game.lighting.addTotalShadowToMaterial(material))
        }

        return material
    }

    copy(baseMaterial, targetMaterial)
    {
        const properties = [ 'color' ]

        for(const property of properties)
        {
            if(typeof baseMaterial[property] !== 'undefined' && typeof targetMaterial[property] !== 'undefined')
                targetMaterial[property] = baseMaterial[property]
        }
    }

    updateObject(mesh)
    {
        mesh.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.material = this.getFromName(child.material.name, child.material)
            }
        })
    }
}