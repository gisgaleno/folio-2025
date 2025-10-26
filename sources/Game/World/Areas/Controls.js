import { Game } from '../../Game.js'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Modals } from '../../Modals.js'
import { Area } from './Area.js'

export class Controls extends Area
{
    constructor(references)
    {
        super(references)

        this.setModal()
        this.setInteractivePoint()
    }

    setModal()
    {
        this.modal = {}
        this.modal.instance = this.game.modals.items.get('controls')

        this.modal.instance.events.on('close', () =>
        {
            this.interactivePoint.reveal()
        })

        this.modal.instance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                this.modal.instance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                this.modal.instance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                this.modal.instance.tabs.goTo('touch')
        })
    }

    setInteractivePoint()
    {
        this.interactivePoint = this.game.interactivePoints.create(
            this.references.get('interactivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('controls')
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
    }
}