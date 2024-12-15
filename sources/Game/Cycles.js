import * as THREE from 'three'
import { Game } from './Game.js'
import { lerp, remap, smoothstep } from './utilities/maths.js'

export class Cycles
{
    constructor()
    {
        this.game = Game.getInstance()

        this.interpolateds = []

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '♻️ Cicles',
                expanded: true,
            })
            this.debugsToRefresh = []
        }


        this.setDay()

        // const test = this.createInterpolated(
        //     [
        //         { color: new THREE.Color('#ff0000'), test: 3, stop: 0.3 },
        //         { color: new THREE.Color('#00ff00'), test: 2, stop: 0.5 },
        //     ],
        //     this.day,
        //     'smoothstep'
        // )

        this.game.time.events.on('tick', () =>
        {
            this.update()
        })
    }

    setDay()
    {
        this.day = {}
        this.day.progress = 0
        this.day.speed = 0.01
        this.day.auto = true

        const presets = {
            day: { lightColor: new THREE.Color('#ffffff'), lightIntensity: 1.2, shadowColor: new THREE.Color('#0085db'), fogColor: new THREE.Color('#b4fbff'), fogNear: 6, fogFar: 45 },
            dusk: { lightColor: new THREE.Color('#ff4141'), lightIntensity: 1.2, shadowColor: new THREE.Color('#840f85'), fogColor: new THREE.Color('#724cff'), fogNear: 6, fogFar: 45 },
            night: { lightColor: new THREE.Color('#3240ff'), lightIntensity: 3.8,  shadowColor: new THREE.Color('#0032db'), fogColor: new THREE.Color('#070e29'), fogNear: 0, fogFar: 21 },
            dawn: { lightColor: new THREE.Color('#ff9000'), lightIntensity: 1.2,   shadowColor: new THREE.Color('#db4700'), fogColor: new THREE.Color('#ffa385'), fogNear: 6, fogFar: 45 },
        }

        this.day.values = this.createInterpolated(
            [
                { properties: presets.day, stop: 0.0 }, // day
                { properties: presets.day, stop: 0.15 }, // day
                { properties: presets.dusk, stop: 0.25 }, // Dusk
                { properties: presets.night, stop: 0.35 }, // Night
                { properties: presets.night, stop: 0.6 }, // Night
                { properties: presets.dawn, stop: 0.8 }, // Dawn
                { properties: presets.day, stop: 0.9 }, // day
            ],
            this.day,
            'smoothstep'
        )

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({
                title: 'Day',
                expanded: true,
            })
            this.debugsToRefresh.push(debugPanel.addBinding(this.day, 'progress', { min: 0, max: 1, step: 0.001 }))
            debugPanel.addBinding(this.day, 'speed', { min: 0, max: 1, step: 0.001 })
            debugPanel.addBinding(this.day, 'auto')
            debugPanel.addButton({ title: 'day' }).on('click', () => { this.day.progress = 0 })
            debugPanel.addButton({ title: 'dusk' }).on('click', () => { this.day.progress = 0.3 })
            debugPanel.addButton({ title: 'night' }).on('click', () => { this.day.progress = 0.5 })
            debugPanel.addButton({ title: 'dawn' }).on('click', () => { this.day.progress = 0.9 })

            for(const presetKey in presets)
            {
                const preset = presets[presetKey]
                const presetsDebugPanel = debugPanel.addFolder({
                    title: presetKey,
                    expanded: true,
                })

                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.lightColor, 'lightColor')
                presetsDebugPanel.addBinding(preset, 'lightIntensity', { min: 0, max: 20 })
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.shadowColor, 'shadowColor')
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.fogColor, 'fogColor')
                presetsDebugPanel.addBinding(preset, 'fogNear', { label: 'near', min: 0, max: 100, step: 0.01 })
                presetsDebugPanel.addBinding(preset, 'fogFar', { label: 'far', min: 0, max: 100, step: 0.01 })
            }

        }
    }

    createInterpolated(steps, cycles, interpolation = 'linear')
    {
        const interpolated = {}
        interpolated.steps = steps
        interpolated.properties = {}
        interpolated.cycles = cycles
        interpolated.interpolation = interpolation

        for(const key in steps[0].properties)
        {
            if(key !== 'stop')
            {
                const property = {}
                property.value = steps[0].properties[key]

                if(property.value instanceof THREE.Color)
                {
                    property.type = 'color'
                    property.value = property.value.clone()
                }
                else if(typeof property.value === 'number')
                {
                    property.type = 'number'
                    property.value = property.value
                }

                interpolated.properties[key] = property
            }
        }

        // Add fake steps to fix non 0-1 stops
        const firstStep = steps[0]
        const lastStep = steps[steps.length - 1]

        if(lastStep.stop < 1)
        {
            const newStep = { ...firstStep }
            newStep.stop = 1 + newStep.stop
            steps.push(newStep)
        }

        if(firstStep.stop > 0)
        {
            const newStep = { ...lastStep }
            newStep.stop = - (1 - newStep.stop)
            steps.unshift(newStep)
        }

        this.interpolateds.push(interpolated)

        return interpolated
    }

    update()
    {
        if(this.day.auto)
            this.day.progress = (this.day.progress + this.game.time.deltaScaled * this.day.speed) % 1

        for(const interpolated of this.interpolateds)
        {
            // Indices
            let indexPrev = -1
            let index = 0

            for(const step of interpolated.steps)
            {
                if(step.stop <= interpolated.cycles.progress)
                    indexPrev = index

                index++
            }

            const indexNext = (indexPrev + 1) % interpolated.steps.length

            // Steps
            const stepPrevious = interpolated.steps[indexPrev]
            const stepNext = interpolated.steps[indexNext]

            // Mix ratio
            let mixRatio = 0
            if(interpolated.interpolation === 'linear')
                mixRatio = remap(interpolated.cycles.progress, stepPrevious.stop, stepNext.stop, 0, 1)
            else if(interpolated.interpolation === 'smoothstep')
                mixRatio = smoothstep(interpolated.cycles.progress, stepPrevious.stop, stepNext.stop)

            // Interpolate properties
            for(const key in interpolated.properties)
            {
                const property = interpolated.properties[key]

                if(property.type === 'color')
                {
                    property.value.lerpColors(stepPrevious.properties[key], stepNext.properties[key], mixRatio)
                }
                else if(property.type === 'number')
                {
                    property.value = lerp(stepPrevious.properties[key], stepNext.properties[key], mixRatio)
                }
            }
        }

        if(this.game.debug.active)
        {
            for(const binding of this.debugsToRefresh)
            {
                binding.refresh()
            }
        }
    }
}