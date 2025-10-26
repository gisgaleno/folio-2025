import { Events } from '../../Events.js'
import { Game } from '../../Game.js'

export class Area
{
    constructor(references)
    {
        this.game = Game.getInstance()
        
        this.references = references

        this.events = new Events()
        
        this.setZone()
    }

    setZone()
    {
        let zoneReference = this.references.get('zone')

        if(!zoneReference)
            return

        zoneReference = zoneReference[0]
        
        const position = zoneReference.position.clone()
        const radius = zoneReference.scale.x
        const zone = this.game.zones.create('cylinder', position, radius)

        zone.events.on(
            'enter',
            () =>
            {
                this.events.trigger('enter')
            }
        )

        zone.events.on(
            'leave',
            () =>
            {
                this.events.trigger('leave')
            }
        )
    }
}