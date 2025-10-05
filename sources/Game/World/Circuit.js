import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { segmentCircleIntersection } from '../utilities/maths.js'
import { InteractivePoints } from '../InteractivePoints.js'
import gsap from 'gsap'
import { Player } from '../Player.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { color, Fn, max, PI, positionWorld, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'

export default class Circuit
{
    constructor(references)
    {
        this.game = Game.getInstance()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🛞 Circuit',
                expanded: true,
            })
        }

        this.references = references

        this.setRoad()
        this.setStartPosition()
        this.setTimer()
        this.setCountdown()
        this.setCheckpoints()
        this.setInteractivePoint()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setRoad()
    {
        this.road = {}
        const mesh = this.references.get('road')[0]
        
        this.road.glitterPositionMultiplier = 0.3
        this.road.glitterPositionDelta = uniform(0)
        this.road.color = uniform(color('#383039'))
        this.road.glitterScarcity = uniform(0.02)
        this.road.glitterLighten = uniform(0.2)
        this.road.middleLighten = uniform(0.075)

        const colorNode = Fn(() =>
        {
            const noiseUv = positionWorld.xz.mul(this.game.noises.resolution).mul(0.2).floor().div(this.game.noises.resolution).div(0.2)
            // const noiseUv = positionWorld.xz.mul(0.2)
            const noise = texture(this.game.noises.others, noiseUv).g
            
            const glitterLighten = this.road.glitterPositionDelta.mul(this.road.glitterScarcity).sub(noise.mul(12.34)).fract().sub(0.5).abs().remapClamp(0, this.road.glitterScarcity, 1, 0).mul(this.road.glitterLighten)
            
            const middleLighten = uv().y.mul(PI).sin().mul(this.road.middleLighten)

            const baseColor = this.road.color.toVar()
            baseColor.addAssign(max(glitterLighten, middleLighten).mul(0.2))

            return vec3(baseColor)
        })()

        const material = new MeshDefaultMaterial({
            colorNode: colorNode,

            hasLightBounce: false,
            hasWater: false,
        })
        mesh.material = material

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({ title: 'road' })
            this.game.debug.addThreeColorBinding(debugPanel, this.road.color.value, 'color')
            debugPanel.addBinding(this.road.glitterScarcity, 'value', { label: 'glitterScarcity', min: 0, max: 0.1, step: 0.001 })
            debugPanel.addBinding(this.road.glitterLighten, 'value', { label: 'glitterLighten', min: 0, max: 0.2, step: 0.001 })
            debugPanel.addBinding(this.road.middleLighten, 'value', { label: 'middleLighten', min: 0, max: 0.2, step: 0.001 })
        }
    }

    setStartPosition()
    {
        const baseStart = this.references.get('start')[0]

        this.startPosition = {}
        this.startPosition.position = baseStart.position.clone()
        this.startPosition.rotation = baseStart.rotation.y
    }

    setTimer()
    {
        this.timer = {}

        this.timer.element = this.game.domElement.querySelector('.js-circuit-timer')
        this.timer.digits = [...this.timer.element.querySelectorAll('.js-digit')]

        this.timer.startTime = 0
        this.timer.endTime = 0
        this.timer.running = false

        this.timer.start = () =>
        {
            this.timer.startTime = this.game.ticker.elapsed

            this.timer.running = true

            this.timer.element.classList.add('is-visible')
        }

        this.timer.end = () =>
        {
            this.timer.endTime = this.game.ticker.elapsed

            this.timer.running = false

            gsap.delayedCall(6, () =>
            {
                this.timer.element.classList.remove('is-visible')
            })
        }

        this.timer.update = () =>
        {
            if(!this.timer.running)
                return

            const currentTime = this.game.ticker.elapsed
            const elapsedTime = currentTime - this.timer.startTime

            const minutes = Math.floor(elapsedTime / 60)
            const seconds = Math.floor((elapsedTime % 60))
            const milliseconds = Math.floor((elapsedTime * 1000) % 1000)

            const digitsString = `${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}${String(milliseconds).padStart(2, '0')}`

            let i = 0
            for(const digit of digitsString)
            {
                this.timer.digits[i].textContent = digit
                i++
            }
        }
    }

    setCountdown()
    {
        this.countdown = {}

        this.countdown.element = this.game.domElement.querySelector('.js-circuit-countdown')
        this.countdown.timeline = gsap.timeline({ paused: true })
        this.countdown.interDuration = 0.5
        this.countdown.endCallback = null

        this.countdown.timeline.add(gsap.delayedCall(this.countdown.interDuration, () =>
        {
            this.countdown.element.textContent = '3'
            this.countdown.element.classList.add('is-visible')
        }))
        this.countdown.timeline.add(gsap.delayedCall(this.countdown.interDuration, () =>
        {
            this.countdown.element.textContent = '2'
        }))
        this.countdown.timeline.add(gsap.delayedCall(this.countdown.interDuration, () =>
        {
            this.countdown.element.textContent = '1'
        }))
        this.countdown.timeline.add(gsap.delayedCall(this.countdown.interDuration, () =>
        {
            if(typeof this.countdown.endCallback === 'function')
                this.countdown.endCallback()
                
            this.countdown.element.textContent = 'GO!'
        }))
        this.countdown.timeline.add(gsap.delayedCall(this.countdown.interDuration, () =>
        {
            this.countdown.element.classList.remove('is-visible')
        }))

        this.countdown.start = (endCallback) =>
        {
            this.countdown.endCallback = endCallback
            this.countdown.timeline.seek(0)
            this.countdown.timeline.play()
        }
    }

    setCheckpoints()
    {
        this.checkpoints = {}
        this.checkpoints.items = []
        this.checkpoints.count = 0
        this.checkpoints.checkRadius = 2
        this.checkpoints.target = null
        this.checkpoints.reachedCount = 0

        // Create checkpoints
        const baseCheckpoints = this.references.get('checkpoints').sort((a, b) => a.name.localeCompare(b.name))

        let i = 0
        for(const baseCheckpoint of baseCheckpoints)
        {
            const checkpoint = {}

            baseCheckpoint.rotation.reorder('YXZ')
            baseCheckpoint.visible = false

            checkpoint.index = i
            checkpoint.position = baseCheckpoint.position.clone()
            checkpoint.rotation = baseCheckpoint.rotation.y
            checkpoint.scale = baseCheckpoint.scale.x * 0.5


            // Center
            checkpoint.center = new THREE.Vector2(checkpoint.position.x, checkpoint.position.z)

            // Segment
            checkpoint.a = new THREE.Vector2(checkpoint.position.x - checkpoint.scale, checkpoint.position.z)
            checkpoint.b = new THREE.Vector2(checkpoint.position.x + checkpoint.scale, baseCheckpoint.position.z)

            checkpoint.a.rotateAround(checkpoint.center, - checkpoint.rotation)
            checkpoint.b.rotateAround(checkpoint.center, - checkpoint.rotation)

            // // Helpers
            // const helperA = new THREE.Mesh(
            //     new THREE.CylinderGeometry(0.1, 0.1, 2, 8, 1),
            //     new THREE.MeshBasicNodeMaterial({ color: 'yellow', wireframe: true })
            // )
            // helperA.position.x = checkpoint.a.x
            // helperA.position.z = checkpoint.a.y
            // this.game.scene.add(helperA)

            // const helperB = new THREE.Mesh(
            //     new THREE.CylinderGeometry(0.1, 0.1, 2, 8, 1),
            //     new THREE.MeshBasicNodeMaterial({ color: 'yellow', wireframe: true })
            // )
            // helperB.position.x = checkpoint.b.x
            // helperB.position.z = checkpoint.b.y
            // this.game.scene.add(helperB)

            // Set target
            checkpoint.setTarget = () =>
            {
                this.checkpoints.target = checkpoint

                // Mesh
                this.checkpoints.doorTarget.scaleUniform.value = checkpoint.scale
                this.checkpoints.doorTarget.mesh.visible = true
                this.checkpoints.doorTarget.mesh.position.copy(checkpoint.position)
                this.checkpoints.doorTarget.mesh.rotation.y = checkpoint.rotation
                this.checkpoints.doorTarget.mesh.scale.x = checkpoint.scale
            }

            // Reach
            checkpoint.reach = () =>
            {
                // Not target
                if(checkpoint !== this.checkpoints.target)
                    return

                // Confetti
                if(this.game.world.confetti)
                {
                    this.game.world.confetti.pop(new THREE.Vector3(checkpoint.a.x, 0, checkpoint.a.y))
                    this.game.world.confetti.pop(new THREE.Vector3(checkpoint.b.x, 0, checkpoint.b.y))
                }

                // Mesh
                this.checkpoints.doorReached.scaleUniform.value = checkpoint.scale
                this.checkpoints.doorReached.mesh.visible = true
                this.checkpoints.doorReached.mesh.position.copy(checkpoint.position)
                this.checkpoints.doorReached.mesh.rotation.y = checkpoint.rotation
                this.checkpoints.doorReached.mesh.scale.x = checkpoint.scale
                
                // Update reach and targets
                this.checkpoints.reachedCount++

                // Final checkpoint (start line)
                if(this.checkpoints.reachedCount === this.checkpoints.count + 2)
                {
                    this.end()
                }

                // Next checkpoint
                else
                {
                    const newTarget = this.checkpoints.items[this.checkpoints.reachedCount % (this.checkpoints.count + 1)]
                    newTarget.setTarget()
                }
                
                
                // No more target
                this.checkpoints.target
            }

            this.checkpoints.count = this.checkpoints.items.length

            // Reset
            checkpoint.reset = () =>
            {
                // // Mesh
                // checkpoint.mesh.visible = false
            }

            // Save
            this.checkpoints.items.push(checkpoint)

            i++
        }

        // Checkpoint doors
        const doorIntensity = uniform(2)
        const doorOutputColor = Fn(([doorColor, doorScale]) =>
        {
            const baseUv = uv()

            const squaredUV = baseUv.toVar()
            squaredUV.y.subAssign(this.game.ticker.elapsedScaledUniform.mul(0.2))
            squaredUV.mulAssign(vec2(
                doorScale,
                1
            ).mul(2))

            const stripes = squaredUV.x.add(squaredUV.y).fract().step(0.5)

            const alpha = baseUv.y.oneMinus().mul(stripes)

            return vec4(doorColor.mul(doorIntensity), alpha)
        })

        const doorGeometry = new THREE.PlaneGeometry(2, 2)

        {
            this.checkpoints.doorTarget = {}
            this.checkpoints.doorTarget.scaleUniform = uniform(2)
            this.checkpoints.doorTarget.color = uniform(color('#32ffc1'))

            const material = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide })
            material.outputNode = doorOutputColor(this.checkpoints.doorTarget.color, this.checkpoints.doorTarget.scaleUniform)
            
            const mesh = new THREE.Mesh(doorGeometry, material)
            mesh.scale.x = 1
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.material = material
            mesh.visible = false
            this.game.scene.add(mesh)

            this.checkpoints.doorTarget.mesh = mesh
        }

        {
            this.checkpoints.doorReached = {}
            this.checkpoints.doorReached.scaleUniform = uniform(2)
            this.checkpoints.doorReached.color = uniform(color('#cbff62'))
            
            const material = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide })
            material.outputNode = doorOutputColor(this.checkpoints.doorReached.color, this.checkpoints.doorReached.scaleUniform)
            
            const mesh = new THREE.Mesh(doorGeometry, material)
            mesh.scale.x = 1
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.material = material
            mesh.visible = false
            this.game.scene.add(mesh)

            this.checkpoints.doorReached.mesh = mesh
        }

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.debugPanel.addFolder({ title: 'checkpoints' })
            this.game.debug.addThreeColorBinding(debugPanel, this.checkpoints.doorTarget.color.value, 'targetColor')
            this.game.debug.addThreeColorBinding(debugPanel, this.checkpoints.doorReached.color.value, 'reachedColor')
            
            debugPanel.addBinding(doorIntensity, 'value', { label: 'intensity', min: 0, max: 5, step: 0.01 })
        }
    }

    setInteractivePoint()
    {
        this.interactivePoint = this.game.interactivePoints.create(
            this.references.get('interactivePoint')[0].position,
            'Start race!',
            InteractivePoints.ALIGN_RIGHT,
            () =>
            {
                this.restart()
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

    restart()
    {
        this.game.player.state = Player.STATE_LOCKED

        // Overlay
        this.game.overlay.show(() =>
        {
            this.game.overlay.hide()

            // Update physical vehicle
            this.game.physicalVehicle.moveTo(
                this.startPosition.position,
                this.startPosition.rotation
            )

            // Countdown
            this.countdown.start(() =>
            {
                this.game.player.state = Player.STATE_DEFAULT

                this.timer.start()
            })

            // Checkpoints
            for(const checkpoint of this.checkpoints.items)
                checkpoint.reset()

            this.checkpoints.items[0].setTarget()

            this.checkpoints.reachedCount = 0
        })
    }

    end()
    {
        this.timer.end()

        this.checkpoints.target = null
    }

    update()
    {
        const playerPosition = new THREE.Vector2(
            this.game.player.position.x,
            this.game.player.position.z
        )

        // Road glitters
        this.road.glitterPositionDelta.value = (this.game.view.camera.position.x + this.game.view.camera.position.z) * this.road.glitterPositionMultiplier

        // Checkpoints
        for(const checkpoint of this.checkpoints.items)
        {
            const intersections = segmentCircleIntersection(
                checkpoint.a.x,
                checkpoint.a.y,
                checkpoint.b.x,
                checkpoint.b.y,
                playerPosition.x,
                playerPosition.y,
                this.checkpoints.checkRadius
            )

            if(intersections.length)
            {
                checkpoint.reach()
            }
        }

        // Timer
        this.timer.update()
    }
}