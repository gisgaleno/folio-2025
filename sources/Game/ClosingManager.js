import { Game } from './Game.js'
import { Modals } from './Modals.js'
import Circuit from './World/Circuit.js'
import { Lab } from './World/Lab.js'
import { Projects } from './World/Projects.js'

export class ClosingManager
{
    constructor()
    {
        this.game = Game.getInstance()

        this.game.inputs.addActions([
            { name: 'close', categories: [ 'modal', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.Escape', 'Gamepad.cross' ] },
            { name: 'pause', categories: [ 'modal', 'racing', 'cinematic', 'wandering' ], keys: [ 'Gamepad.start' ] }
        ])
        
        // Close input => Go through everything that can be closed
        this.game.inputs.events.on('close', (action) =>
        {
            if(action.active)
            {
                // Whispers flag select => Close
                if(this.game.world.whispers?.modal.inputFlag.isOpen)
                    this.game.world.whispers.modal.inputFlag.close()
                
                // Modal open => Close
                else if(this.game.modals.state === Modals.OPEN)
                    this.game.modals.close()

                // Circuit running
                else if(this.game.world.areas?.circuit?.state === Circuit.STATE_RUNNING || this.game.world.areas?.circuit?.state === Circuit.STATE_STARTING)
                    this.game.modals.open('circuit')

                // Projects => Close
                else if(this.game.world.areas?.projects?.state === Projects.STATE_OPEN)
                    this.game.world.areas.projects.close()

                // Lab => Close
                else if(this.game.world.areas?.lab?.state === Lab.STATE_OPEN)
                    this.game.world.areas.lab.close()

                // Nothing opened and used the keyboard Escape key => Open default modal
                else if(action.activeKeys.has('Keyboard.Escape'))
                    this.game.modals.open('intro')
            }
        })

        // Pause input => Close modal or open intro
        this.game.inputs.events.on('pause', (action) =>
        {
            if(action.active)
            {
                if((this.game.modals.state === Modals.OPEN || this.game.modals.state === Modals.OPENING))
                {
                    this.game.modals.close()
                }
                else
                {
                    this.game.modals.open('intro')
                }
            }
        })

        // On modal close => Go to wandering or racing
        this.game.modals.events.on('close', () =>
        {
            this.game.inputs.filters.clear()

            if(
                this.game.world.areas?.circuit?.state === Circuit.STATE_RUNNING ||
                this.game.world.areas?.circuit?.state === Circuit.STATE_STARTING ||
                this.game.world.areas?.circuit?.state === Circuit.STATE_ENDING
            )
            {
                this.game.inputs.filters.add('racing')
            }
            else
            {
                this.game.inputs.filters.add('wandering')
            }
        })
    }
}