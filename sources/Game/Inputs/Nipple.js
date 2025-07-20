export class Nipple
{
    constructor(container, eventsTarget)
    {
        this.container = container
        this.eventsTarget = eventsTarget

        this.edgeRadius = 90
        this.thumbRadius = 30
        this.maxRadius = this.edgeRadius

        this.active = false
        this.anchorX = 0
        this.anchorY = 0
        this.x = 0
        this.y = 0
        this.angle = 0
        this.strength = 0

        this.setElement()
        this.setEvents()
    }

    setElement()
    {
        this.element = document.createElement('div')
        this.element.classList.add('nipple')
        this.element.style.setProperty('--edgeRadius', `${this.edgeRadius}px`)
        this.element.style.setProperty('--thumbRadius', `${this.thumbRadius}px`)

        this.edge = document.createElement('div')
        this.edge.classList.add('edge')
        this.element.append(this.edge)

        this.thumb = document.createElement('div')
        this.thumb.classList.add('thumb')
        this.element.append(this.thumb)
        
        this.container.append(this.element)
    }

    setEvents()
    {
        const start = (_event) =>
        {
            if(_event.touches.length === 1)
            {
                this.start(_event.touches[0].clientX, _event.touches[0].clientY)
            }
            else
            {
                this.end()
            }

            this.eventsTarget.addEventListener('touchmove', move, { passive: true })
            this.eventsTarget.addEventListener('touchend', end, { passive: true })
        }

        const move = (_event) =>
        {
            if(_event.touches.length === 1)
                this.move(_event.touches[0].clientX, _event.touches[0].clientY)
        }

        const end = () =>
        {
            this.end()

            this.eventsTarget.removeEventListener('touchmove', move)
            this.eventsTarget.addEventListener('touchend', end, { passive: true })
        }

        this.eventsTarget.addEventListener('touchstart', start, { passive: true })
    }

    start(x, y)
    {
        this.active = true
        this.anchorX = x
        this.anchorY = y
        this.x = 0
        this.y = 0
        this.angle = 0
        this.strength = 0

        this.edge.style.transform = 'translate(0, 0)'
        this.thumb.style.transform = 'translate(0, 0)'

        this.element.style.left = `${this.anchorX}px`
        this.element.style.top = `${this.anchorY}px`
        this.element.classList.add('is-visible')
    }

    move(x, y)
    {
        this.x = x - this.anchorX
        this.y = y - this.anchorY
        this.angle = Math.atan2(this.y, this.x)

        this.radius = Math.hypot(this.x, this.y)

        if(this.radius > this.maxRadius)
        {
            const overflow = this.radius - this.maxRadius
            const dampedOverflow = Math.sqrt(1 + overflow)

            const edgeX = Math.cos(this.angle) * dampedOverflow * 2
            const edgeY = Math.sin(this.angle) * dampedOverflow * 2

            this.edge.style.transform = `translate(${edgeX}px, ${edgeY}px)`

            this.x = Math.cos(this.angle) * (this.maxRadius + dampedOverflow * 3)
            this.y = Math.sin(this.angle) * (this.maxRadius + dampedOverflow * 3)
        }

        this.strength = Math.min(this.radius / this.maxRadius, 1)

        this.thumb.style.transform = `translate(${this.x}px, ${this.y}px)`
    }

    end()
    {
        this.active = false
        this.x = 0
        this.y = 0
        this.angle = 0
        this.strength = 0

        this.element.classList.remove('is-visible')
    }
}