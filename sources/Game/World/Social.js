import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InteractiveAreas } from '../InteractiveAreas.js'
import socialData from '../../data/social.js'

export class Social
{
    constructor(references)
    {
        this.game = Game.getInstance()

        this.references = references
        this.center = this.references.get('center')[0].position

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '👨‍🦲 Bruno',
                expanded: false,
            })
        }

        this.setLinks()
    }

    setLinks()
    {
        const radius = 6
        let i = 0

        for(const link of socialData)
        {
            const angle = i * Math.PI / (socialData.length - 1)
            const position = this.center.clone()
            position.x += Math.cos(angle) * radius
            position.y = 1
            position.z -= Math.sin(angle) * radius

            this.interactiveArea = this.game.interactiveAreas.create(
                position,
                link.name,
                link.align === 'left' ? InteractiveAreas.ALIGN_LEFT : InteractiveAreas.ALIGN_RIGHT,
                () =>
                {
                    window.open(link.url, '_blank')
                }
            )
            
            i++
        }
    }
}