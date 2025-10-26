import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { Area } from './Area.js'

export class Toilet extends Area
{
    constructor(references)
    {
        super(references)

        this.setCandleFlames()
        this.setAchievement()
    }

    setCandleFlames()
    {
        const mesh = this.references.get('moon')[0]
        mesh.visible = this.game.dayCycles.intervalEvents.get('lights').inInverval

        this.game.dayCycles.events.on('lights', (inInverval) =>
        {
            mesh.visible = inInverval
        })
    }

    setAchievement()
    {
        this.events.on('enter', () =>
        {
            this.game.achievements.setProgress('toiletEnter', 1)
        })
    }
}