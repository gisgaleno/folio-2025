import { Events } from './Events.js'
import { Game } from './Game.js'

export class Modals
{
    static OPENED = 1
    static OPENING = 2
    static CLOSING = 3
    static CLOSED = 4
    
    constructor()
    {
        this.game = Game.getInstance()
        this.state = Modals.CLOSED
        this.element = document.querySelector('.js-modals')
        this.current = null
        this.pending = null
        this.default = null
        this.preventInputClose = false

        this.setClose()
        this.setItems()
        this.preopen()
        
        this.element.addEventListener('transitionend', () =>
        {
            this.onTransitionEnded()
        })

        this.game.inputs.addMap([
            { name: 'close', categories: [ 'ui', 'playing' ], keys: [ 'Escape' ] },
        ])
    }

    onTransitionEnded()
    {
        if(this.state === Modals.OPENING)
        {
            this.state = Modals.OPENED
            this.current.events.trigger('opened')
        }
        else if(this.state === Modals.CLOSING)
        {
            this.state = Modals.CLOSED
            this.current.events.trigger('closed')
            this.current.element.classList.remove('is-displayed')
            
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
            if(this.preventInputClose)
                return

            if(event.down)
            {
                if(this.state === Modals.OPENED || this.state === Modals.OPENING)
                {
                    this.pending = null
                    this.close()
                }
                else if(this.state === Modals.CLOSED || this.state === Modals.CLOSING)
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

        // Already visible => Set pending
        if(this.state === Modals.OPENED || this.state === Modals.OPENING)
        {
            if(item === this.current)
                return

            this.pending = name
            this.close()
        }
        // Already closing => Set (or change) pending
        else if(this.state === Modals.CLOSING)
        {
            this.pending = name
        }
        // Currently closed => Open immediately
        else if(this.state === Modals.CLOSED)
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

            this.state = Modals.OPENING
            this.current = item
            this.game.inputs.updateFilters(['ui'])

            item.events.trigger('open')
        }

    }

    close()
    {
        if(this.state === Modals.CLOSING || this.state === Modals.CLOSED)
            return

        this.element.classList.remove('is-visible')

        this.state = Modals.CLOSING
        this.game.inputs.updateFilters([])
        this.current.events.trigger('close')
    }

    preopen()
    {
        this.items.forEach((item) => 
        {
            // Is preopened
            if(item.element.classList.contains('is-displayed'))
            {
                this.open(item.name)

                // Debug > Wait two frames and close modal
                if(this.game.debug.active)
                {
                    requestAnimationFrame(() =>
                    {
                        requestAnimationFrame(() =>
                        {
                            this.close()
                        })
                    })
                }                    
            }
        })
    }
}