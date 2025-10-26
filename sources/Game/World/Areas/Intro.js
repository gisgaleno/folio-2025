import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'

export class Intro extends Area
{
    constructor(references)
    {
        super(references)
        
        this.setInteractivePoint()
        this.setAchievement()
    }

    setInteractivePoint()
    {
        this.interactivePoint = this.game.interactivePoints.create(
            this.references.get('interactivePoint')[0].position,
            'Read me!',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('intro')
                this.interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        this.game.modals.items.get('intro').events.on('close', () =>
        {
            this.interactivePoint.reveal()
        })
    }

    setAchievement()
    {
        this.events.on('leave', () =>
        {
            this.game.achievements.setProgress('introLeave', 1)
        })
    }
}