import * as THREE from 'three'
import { positionLocal, varying, uv, max, positionWorld, float, Fn, uniform, color, mix, vec3, vec4, normalWorld } from 'three'
import { Game } from './Game.js'
import { blendDarken_2 } from './tsl/blendings.js'

export class Materials
{
    constructor()
    {
        this.game = new Game()
        this.list = new Map()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🎨 Materials',
                expanded: false,
            })
        }

        this.setLuminance()
        this.setTest()
        this.setNodes()
        this.setPremades()
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

    setPremades()
    {
        // Create materials functions
        const createEmissiveMaterial = (_name = 'material', _color = '#ffffff', _intensity = '100') =>
        {
            const threeColor = new THREE.Color(_color)

            const dummy = {}
            dummy.color = threeColor.getHex(THREE.SRGBColorSpace)
            dummy.intensity = _intensity

            const material = new THREE.MeshBasicNodeMaterial({ color: threeColor })
            this.save(_name, material)
            
            const update = () =>
            {
                material.color.set(dummy.color)
                material.color.multiplyScalar(dummy.intensity / this.luminance.get(material.color))
            }

            update()

            if(this.game.debug.active)
            {
                const debugPanel = this.debugPanel.addFolder({
                    title: _name,
                    expanded: true
                })
                debugPanel.addBinding(dummy, 'intensity', { min: 0, max: 300, step: 1 }).on('change', update)
                debugPanel.addBinding(dummy, 'color', { view: 'color' }).on('change', update)
            }
        }

        const createGradientMaterial = (_name = 'material', _colorA = 'red', _colorB = 'blue') =>
        {
            const threeColorA = new THREE.Color(_colorA)
            const threeColorB = new THREE.Color(_colorB)

            const material = new THREE.MeshLambertNodeMaterial()
            material.shadowSide = THREE.BackSide
            
            const colorA = uniform(threeColorA)
            const colorB = uniform(threeColorB)
            const baseColor = mix(colorA, colorB, uv().y)
            material.outputNode = this.lightOutputNode(baseColor, this.getTotalShadow(material))
            
            this.save(_name, material)

            if(this.game.debug.active)
            {
                const debugPanel = this.debugPanel.addFolder({
                    title: _name,
                    expanded: true
                })
                debugPanel.addBinding({ colorA: threeColorA.getHex(THREE.SRGBColorSpace) }, 'colorA', { view: 'color' }).on('change', (tweak) => { colorA.value.set(tweak.value) })
                debugPanel.addBinding({ colorB: threeColorB.getHex(THREE.SRGBColorSpace) }, 'colorB', { view: 'color' }).on('change', (tweak) => { colorB.value.set(tweak.value) })
            }
        }

        // Car red
        createGradientMaterial('carRed', '#ff3a3a', '#721551')

        // Pure white
        const pureWhite = new THREE.MeshLambertNodeMaterial()
        pureWhite.shadowSide = THREE.BackSide
        pureWhite.outputNode = this.lightOutputNode(color('#ffffff'), this.getTotalShadow(pureWhite))
        this.save('pureWhite', pureWhite)
    
        // Emissive warn white
        createEmissiveMaterial('emissiveWarnWhite', '#ff8641', 100)
    
        // // Emissive red
        createEmissiveMaterial('emissiveRed', '#ff3131', 100)
    
        // // Emissive red
        createEmissiveMaterial('emissivePurple', '#9830ff', 100)
    }

    setNodes()
    {
        this.lightBounceColor = uniform(color('#646615'))
        this.lightBounceEdgeLow = uniform(float(-1))
        this.lightBounceEdgeHigh = uniform(float(1))
        this.lightBounceDistance = uniform(float(1.5))

        this.shadowColor = uniform(color('#0085db'))
        this.coreShadowEdgeLow = uniform(float(-0.25))
        this.coreShadowEdgeHigh = uniform(float(1))

        // Get total shadow
        this.getTotalShadow = (material) =>
        {
            const totalShadows = float(1).toVar()
            material.receivedShadowNode = Fn(([ shadow ]) => 
            {
                totalShadows.mulAssign(shadow)
                return float(1)
            })

            return totalShadows
        }

        // Light output
        this.lightOutputNode = Fn(([inputColor, totalShadows]) =>
        {
            const baseColor = inputColor.toVar()

            // Light
            const lightenColor = baseColor.mul(this.game.lighting.colorUniform.mul(this.game.lighting.intensityUniform))

            // Bounce color
            const bounceOrientation = normalWorld.dot(vec3(0, - 1, 0)).smoothstep(this.lightBounceEdgeLow, this.lightBounceEdgeHigh)
            const bounceDistance = this.lightBounceDistance.sub(positionWorld.y).div(this.lightBounceDistance).max(0).pow(2)
            lightenColor.assign(mix(lightenColor, this.lightBounceColor, bounceOrientation.mul(bounceDistance)))

            // Core shadow
            const coreShadowMix = normalWorld.dot(this.game.lighting.directionUniform).smoothstep(this.coreShadowEdgeHigh, this.coreShadowEdgeLow)
            
            // Cast shadow
            const castShadowMix = totalShadows.oneMinus()

            // Combined shadows
            const combinedShadowMix = max(coreShadowMix, castShadowMix).clamp(0, 1)
            
            const shadowColor = baseColor.rgb.mul(this.shadowColor).rgb
            const shadedColor = mix(lightenColor, shadowColor, combinedShadowMix)
            
            // return vec4(vec3(castShadowMix), 1)
            return vec4(shadedColor.rgb, 1)
        })
        
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding({ color: this.lightBounceColor.value.getHex(THREE.SRGBColorSpace) }, 'color', { label: 'lightBounceColor', view: 'color' })
                .on('change', tweak => { this.lightBounceColor.value.set(tweak.value) })
            this.debugPanel.addBinding(this.lightBounceEdgeLow, 'value', { label: 'lightBounceEdgeLow', min: - 1, max: 1, step: 0.01 })
            this.debugPanel.addBinding(this.lightBounceEdgeHigh, 'value', { label: 'lightBounceEdgeHigh', min: - 1, max: 1, step: 0.01 })
            this.debugPanel.addBinding(this.lightBounceDistance, 'value', { label: 'lightBounceDistance', min: 0, max: 5, step: 0.01 })

            this.debugPanel.addBinding({ color: this.shadowColor.value.getHex(THREE.SRGBColorSpace) }, 'color', { label: 'shadowColor', view: 'color' })
                .on('change', tweak => { this.shadowColor.value.set(tweak.value) })

            this.debugPanel.addBinding(this.coreShadowEdgeLow, 'value', { label: 'coreShadowEdgeLow', min: - 1, max: 1, step: 0.01 })
            this.debugPanel.addBinding(this.coreShadowEdgeHigh, 'value', { label: 'coreShadowEdgeHigh', min: - 1, max: 1, step: 0.01 })
        }
    }

    setTest()
    {
        this.tests = {}
        this.tests.list = new Map()
        this.tests.sphereGeometry = new THREE.IcosahedronGeometry(1, 3)
        this.tests.boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
        this.tests.group = new THREE.Group()
        this.tests.group.visible = true
        this.game.scene.add(this.tests.group)
        
        this.tests.update = () =>
        {
            this.list.forEach((material, name) =>
            {
                if(!this.tests.list.has(name))
                {
                    const test = {}

                    // Pure
                    const pureColor = material.color.clone()
                    const maxLength = Math.max(pureColor.r, Math.max(pureColor.g, pureColor.b))
                    if(maxLength > 1)
                        pureColor.set(pureColor.r / maxLength, pureColor.g / maxLength, pureColor.b / maxLength)
                    
                    const boxPure = new THREE.Mesh(this.tests.boxGeometry, new THREE.MeshBasicMaterial({ color: pureColor }))
                    boxPure.position.y = 0.75
                    boxPure.position.x = this.list.size * 3
                    boxPure.position.z = 0
                    boxPure.castShadow = true
                    boxPure.receiveShadow = true
                    this.tests.group.add(boxPure)
                
                    // Box
                    const box = new THREE.Mesh(this.tests.boxGeometry, material)
                    box.position.y = 0.75
                    box.position.x = this.list.size * 3
                    box.position.z = 3
                    box.castShadow = true
                    box.receiveShadow = true
                    this.tests.group.add(box)

                    // Sphere
                    const sphere = new THREE.Mesh(this.tests.sphereGeometry, material)
                    sphere.position.z = 6
                    sphere.position.y = 0.75
                    sphere.position.x = this.list.size * 3
                    sphere.castShadow = true
                    sphere.receiveShadow = true
                    this.tests.group.add(sphere)

                    this.tests.list.set(name, test)
                }
            })
        }
        
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this.tests.group, 'visible', { label: 'testsVisibile' })
        }
    }

    save(name, material)
    {
        this.list.set(name, material)
        this.tests.update()
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
            material.outputNode = this.lightOutputNode(baseMaterial.color, this.getTotalShadow(material))
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