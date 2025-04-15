import { Game } from '../Game.js'
import { InteractiveAreas } from '../InteractiveAreas2.js'

export class Intro
{
    constructor(interactiveAreaPosition)
    {
        this.game = Game.getInstance()
        
        this.interactiveAreaPosition = interactiveAreaPosition

        this.setInteractiveArea()

        let firstTimeIntro = true

        this.game.modals.items.get('intro').events.on('close', () =>
        {
            if(firstTimeIntro)
                this.game.audio.music.play()
            
            firstTimeIntro = false
        })
    }

    setInteractiveArea()
    {
        this.game.interactiveAreas.create(
            this.interactiveAreaPosition,
            'Read me!',
            InteractiveAreas.ALIGN_RIGHT,
            () =>
            {
                this.game.modals.open('intro')
            }
        )
    }
}