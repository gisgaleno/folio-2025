import { Events } from './Events.js'
import { Game } from './Game.js'

export class Modals
{
    constructor()
    {
        this.game = Game.getInstance()
        this.visible = false
        this.element = document.querySelector('.js-modals')
        this.current = null
        this.pending = null
        this.default = null

        this.setClose()
        this.setItems()
        this.preopen()
        
        this.element.addEventListener('transitionend', () =>
        {
            this.onTransitionEnded()
        })
    }

    onTransitionEnded()
    {
        if(!this.visible)
        {
            this.current.events.trigger('closed')
            this.current.element.classList.remove('is-displayed')
            this.current = null
            
            // Pending => Open pending
            if(this.pending)
            {
                this.open(this.pending)
                this.pending = null
            }

            // No pending => Fully hide
            else
            {
                this.element.classList.remove('is-displayed')
            }
        }
        else
        {
            this.current.events.trigger('opened')
        }
    }

    setItems()
    {
        const elements = this.element.querySelectorAll('.js-modal')
        
        this.items = new Map()
        
        for(const element of elements)
        {
            const name = element.dataset.name

            const item = {
                name: name,
                element: element,
                mainFocus: element.querySelector('.js-main-focus'),
                events: new Events()
            }

            this.items.set(name, item)

            if(typeof element.dataset.default !== 'undefined')
                this.default = item
        }
    }

    setClose()
    {
        const closeElements = this.element.querySelectorAll('.js-close')

        for(const element of closeElements)
        {
            element.addEventListener('click', () =>
            {
                this.pending = null
                this.close()
            })
        }

        this.game.inputs.events.on('close', (event) =>
        {
            if(event.down)
            {
                if(this.visible)
                {
                    this.pending = null
                    this.close()
                }
                else
                {
                    if(this.default)
                        this.open(this.default.name)
                }
            }
        })
    }

    open(name)
    {
        const item = this.items.get(name)

        if(!item)
            return

        if(item === this.current)
            return

        // Currently closed => Open immediately
        if(!this.visible)
        {
            this.element.classList.add('is-displayed')
            item.element.classList.add('is-displayed')

            requestAnimationFrame(() =>
            {
                requestAnimationFrame(() =>
                {
                    this.element.classList.add('is-visible')

                    // Focus
                    if(item.mainFocus)
                        item.mainFocus.focus()
                })
            })

            this.visible = true
            this.current = item
            this.game.inputs.updateFilters(['ui'])

            item.events.trigger('open')
        }

        // Already visible => Set pending
        else
        {
            this.pending = name
            this.close()
        }
    }

    close()
    {
        if(!this.visible)
            return

        this.element.classList.remove('is-visible')

        this.visible = false
        this.game.inputs.updateFilters([])
        this.current.events.trigger('close')
    }

    preopen()
    {
        this.items.forEach((item) => 
        {
            if(item.element.classList.contains('is-displayed'))
            {
                this.open(item.name)
            }
        })
    }
}