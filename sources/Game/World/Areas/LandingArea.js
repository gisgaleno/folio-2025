import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'

export class LandingArea extends Area
{
    constructor(references)
    {
        super(references)

        this.setLetters()
        this.setInteractivePoint()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.get('letters')

        for(const reference of references)
        {
            const physical = reference.userData.object.physical
            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }
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
            this.interactivePoint.show()
        })
    }

    setAchievement()
    {
        this.events.on('enter', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('leave', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }
}