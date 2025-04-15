import normalizeWheel from 'normalize-wheel'
import * as THREE from 'three/webgpu'

import { Events } from './Events.js'
import { Game } from './Game.js'

export class Inputs
{
    constructor(_map)
    {
        this.game = Game.getInstance()
        this.events = new Events()

        this.map = _map
        this.filters = []

        this.setKeys()
        this.setPointer()
        this.setWheel()
    }

    setWheel()
    {
        addEventListener('wheel', (_event) =>
        {
            const normalized = normalizeWheel(_event)
            this.events.trigger('zoom', [ normalized.spinY ])
        }, { passive: true })
    }

    setPointer()
    {
        this.pointer = {}
        this.pointer.current = new THREE.Vector2()
        this.pointer.delta = new THREE.Vector2()
        this.pointer.upcoming = new THREE.Vector2()
        this.pointer.isDown = false

        this.game.domElement.addEventListener('pointermove', (_event) =>
        {
            this.pointer.upcoming.set(_event.clientX, _event.clientY)
        })

        this.game.domElement.addEventListener('pointerdown', (_event) =>
        {
            this.pointer.isDown = true
        })

        addEventListener('pointerup', (_event) =>
        {
            this.pointer.isDown = false
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.pointer.delta.copy(this.pointer.upcoming).sub(this.pointer.current)
            this.pointer.current.copy(this.pointer.upcoming)
        }, 0)
    }

    setKeys()
    {
        this.keys = {}

        for(const _map of this.map)
            this.keys[_map.name] = false

        addEventListener('keydown', (_event) =>
        {
            this.down(_event.code)
        })

        addEventListener('keyup', (_event) =>
        {
            this.up(_event.code)
        })
    }

    checkCategory(map)
    {
        // No filter => Allow all
        if(this.filters.length === 0)
            return true

        // Has filter but no category on map => Forbid
        if(map.categories.length === 0)
            return false

        // Has matching category and filter => All
        for(const category of map.categories)
        {
            if(this.filters.indexOf(category) !== -1)
                return true
        }

        // Otherwise => Forbid
        return false
    }

    down(key)
    {
        const map = this.map.find((_map) => _map.keys.indexOf(key) !== - 1 )

        if(map && !this.keys[map.name] && this.checkCategory(map))
        {
            this.keys[map.name] = true
            this.events.trigger('keyDown', [ { down: true, name: map.name } ])
            this.events.trigger(map.name, [ { down: true, name: map.name } ])
        }
    }

    up(key)
    {
        const map = this.map.find((_map) => _map.keys.indexOf(key) !== - 1 )

        if(map && this.keys[map.name])
        {
            this.keys[map.name] = false
            this.events.trigger('keyUp', [ { down: false, name: map.name } ])
            this.events.trigger(map.name, [ { down: false, name: map.name } ])
        }
    }

    updateFilters(filters = [])
    {
        this.filters = filters
    }
}