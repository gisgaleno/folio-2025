import { Events } from './Events.js'

export class Time
{
    constructor()
    {
        this.elapsed = 0
        this.delta = 1 / 60
        this.maxDelta = 1 / 30

        this.events = new Events()
        this.setTick()
    }

    setTick()
    {
        const tick = (elapsed) =>
        {
            const elapsedSeconds = elapsed / 1000
            this.delta = Math.min(elapsedSeconds - this.elapsed, this.maxDelta)
            this.elapsed = elapsedSeconds

            this.events.trigger('tick')

            requestAnimationFrame(tick)
        }
        tick()
    }
}