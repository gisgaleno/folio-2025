import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { remap, remapClamp } from '../utilities/maths.js'

export class PhysicsVehicle
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        this.steeringAmplitude = 0.5
        this.engineForceAmplitude = 7
        this.boostMultiplier = 2
        this.maxSpeed = 5
        this.brakeAmplitude = 35
        this.idleBrake = 0.06
        this.reverseBrake = 0.4
        this.flipForce = 6

        this.sideward = new THREE.Vector3(0, 0, 1)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.forward = new THREE.Vector3(1, 0, 0)
        this.position = new THREE.Vector3(0, 4, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.direction = this.forward.clone()
        this.speed = 0
        this.absoluteSpeed = 0
        this.suspensionsHeights = {
            low: 0.88,
            mid: 1.23,
            high: 1.63
        }
        this.suspensionsStiffness = {
            low: 20,
            mid: 30,
            high: 40
        }

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.physics.debugPanel.addFolder({
                title: 'Vehicle',
                expanded: true,
            })

            this.debugPanel.addBinding(this, 'steeringAmplitude', { min: 0, max: Math.PI * 0.5, step: 0.01 })
            this.debugPanel.addBinding(this, 'engineForceAmplitude', { min: 1, max: 20, step: 1 })
            this.debugPanel.addBinding(this, 'boostMultiplier', { min: 1, max: 5, step: 0.01 })
            this.debugPanel.addBinding(this, 'maxSpeed', { min: 0, max: 20, step: 0.1 })
            this.debugPanel.addBinding(this, 'brakeAmplitude', { min: 0, max: 200, step: 0.01 })
            this.debugPanel.addBinding(this, 'idleBrake', { min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this, 'reverseBrake', { min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this, 'flipForce', { min: 0, max: 10, step: 0.01 })

            this.debugPanel.addBinding(this.suspensionsHeights, 'low', { min: 0, max: 2, step: 0.01 })
            this.debugPanel.addBinding(this.suspensionsHeights, 'mid', { min: 0, max: 2, step: 0.01 })
            this.debugPanel.addBinding(this.suspensionsHeights, 'high', { min: 0, max: 2, step: 0.01 })

            this.debugPanel.addBinding(this.suspensionsStiffness, 'low', { min: 0, max: 100, step: 0.1 })
            this.debugPanel.addBinding(this.suspensionsStiffness, 'mid', { min: 0, max: 100, step: 0.1 })
            this.debugPanel.addBinding(this.suspensionsStiffness, 'high', { min: 0, max: 100, step: 0.1 })
        }

        this.setChassis()
        this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)
        this.setWheels()
        this.setStop()
        this.setUpsideDown()
        this.setExplosions()
        this.setTornado()

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)
        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 5)
    }

    setChassis()
    {
        this.chassis = {}
        this.chassis.physical = this.game.physics.getPhysical({
            type: 'dynamic',
            position: this.position,
            friction: 0.4,
            rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Euler(0, 1, 0), Math.PI * 0),
            colliders: [
                { shape: 'cuboid', mass: 2.5, parameters: [ 1, 0.4, 0.85 ], position: { x: 0, y: -0.1, z: 0 }, centerOfMass: { x: 0, y: -0.5, z: 0 } }, // Main
                { shape: 'cuboid', mass: 0, parameters: [ 0.5, 0.15, 0.65 ], position: { x: 0, y: 0.4, z: 0 } }, // Top
                { shape: 'cuboid', mass: 0, parameters: [ 1.5, 0.5, 0.9 ], position: { x: 0.1, y: -0.2, z: 0 }, category: 'bumper' }, // Bumper
            ],
            canSleep: false,
            waterGravityMultiplier: - 1
        })
        this.chassis.mass = this.chassis.physical.body.mass()
    }

    setWheels()
    {
        // Setup
        this.wheels = {}
        this.wheels.items = []

        // Create wheels
        for(let i = 0; i < 4; i++)
        {
            const wheel = {}

            wheel.inContact = false
            wheel.contactPoint = null
            wheel.suspensionLength = null
            wheel.suspensionState = 'low'

            // Default wheel with random parameters
            this.controller.addWheel(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), 1, 1)

            // Base position
            wheel.basePosition = new THREE.Vector3()

            this.wheels.items.push(wheel)
        }

        // Settings
        this.wheels.settings = {
            offset: { x: 0.90, y: 0, z: 0.75 },
            radius: 0.4,
            directionCs: { x: 0, y: -1, z: 0 },
            axleCs: { x: 0, y: 0, z: 1 },
            frictionSlip: 0.9,
            maxSuspensionForce: 150,
            maxSuspensionTravel: 2,
            sideFrictionStiffness: 3,
            suspensionCompression: 10,
            suspensionRelaxation: 2.7,
            suspensionStiffness: 25,
        }

        this.wheels.updateSettings = () =>
        {
            this.wheels.perimeter = this.wheels.settings.radius * Math.PI * 2

            const wheelsPositions = [
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
            ]
            
            let i = 0
            for(const wheel of this.wheels.items)
            {
                wheel.basePosition.copy(wheelsPositions[i])
                
                this.controller.setWheelDirectionCs(i, this.wheels.settings.directionCs)
                this.controller.setWheelAxleCs(i, this.wheels.settings.axleCs)
                this.controller.setWheelRadius(i, this.wheels.settings.radius)
                this.controller.setWheelChassisConnectionPointCs(i, wheel.basePosition)
                this.controller.setWheelFrictionSlip(i, this.wheels.settings.frictionSlip)
                this.controller.setWheelMaxSuspensionForce(i, this.wheels.settings.maxSuspensionForce)
                this.controller.setWheelMaxSuspensionTravel(i, this.wheels.settings.maxSuspensionTravel)
                this.controller.setWheelSideFrictionStiffness(i, this.wheels.settings.sideFrictionStiffness)
                this.controller.setWheelSuspensionCompression(i, this.wheels.settings.suspensionCompression)
                this.controller.setWheelSuspensionRelaxation(i, this.wheels.settings.suspensionRelaxation)

                i++
            }
        }

        this.wheels.updateSettings()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBlade({ view: 'separator' })
            this.debugPanel.addBinding(this.wheels.settings, 'offset', { min: -1, max: 2, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'radius', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'frictionSlip', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'maxSuspensionForce', { min: 0, max: 1000, step: 1 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'maxSuspensionTravel', { min: 0, max: 2, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'sideFrictionStiffness', { min: 0, max: 10, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'suspensionCompression', { min: 0, max: 30, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'suspensionRelaxation', { min: 0, max: 10, step: 0.01 }).on('change', this.wheels.updateSettings)
            this.debugPanel.addBinding(this.wheels.settings, 'suspensionStiffness', { min: 0, max: 100, step: 0.1 }).on('change', this.wheels.updateSettings)
        }
    }

    setStop()
    {
        this.stop = {}
        this.stop.active = true
        this.stop.lowThreshold = 0.04
        this.stop.highThreshold = 0.7

        this.stop.test = () =>
        {

            if(this.absoluteSpeed < this.stop.lowThreshold)
            {
                if(!this.stop.active)
                {
                    this.stop.active = true
                    this.events.trigger('stop')
                }
            }
            else if(this.absoluteSpeed > this.stop.highThreshold)
            {
                if(this.stop.active)
                {
                    this.stop.active = false
                    this.events.trigger('start')
                }
            }
        }
    }

    setUpsideDown()
    {
        this.upsideDown = {}
        this.upsideDown.active = false
        this.upsideDown.ratio = 0
        this.upsideDown.threshold = 0.3

        this.upsideDown.test = () =>
        {
            this.upsideDown.ratio = this.upward.dot(new THREE.Vector3(0, - 1, 0)) * 0.5 + 0.5

            if(this.upsideDown.ratio > this.upsideDown.threshold)
            {
                if(!this.upsideDown.active)
                {
                    this.upsideDown.active = true
                    this.events.trigger('upsideDown')
                }
            }
            else
            {
                if(this.upsideDown.active)
                {
                    this.upsideDown.active = false
                    this.events.trigger('rightSideUp')
                }
            }
        }
    }

    setExplosions()
    {
        this.game.explosions.events.on('explosion', (coordinates) =>
        {
            const direction = this.position.clone().sub(coordinates)
            direction.y = 0
            const distance = Math.hypot(direction.x, direction.z)

            const strength = remapClamp(distance, 1, 7, 1, 0)
            const impulse = direction.clone().normalize()
            impulse.y = 1
            impulse.setLength(strength * this.chassis.mass * 4)

            if(strength > 0)
            {
                const point = direction.negate().setLength(0).add(this.position)
                requestAnimationFrame(() =>
                {
                    this.chassis.physical.body.applyImpulseAtPoint(impulse, point)
                })
            }
        })
    }

    setTornado()
    {
        this.tornado = {}
        
        this.tornado.apply = () =>
        {
            const toTornado = this.game.tornado.position.clone().sub(this.position)
            const distance = toTornado.length()
            
            const strength = remapClamp(distance, 20, 2, 0, 1)

            const force = toTornado.clone().normalize()

            const sideAngleStrength = remapClamp(distance, 8, 2, 0, Math.PI * 0.25)
            force.applyAxisAngle(new THREE.Vector3(0, 1, 0), -sideAngleStrength)

            const flyForce = remapClamp(distance, 8, 2, 0, 1)
            force.y = flyForce * 2

            force.setLength(strength * this.game.ticker.deltaScaled * this.game.tornado.strength * 30)
            this.chassis.physical.body.applyImpulse(force)
        }
    }

    moveTo(position, rotation = 0)
    {
        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
        this.chassis.physical.body.setTranslation(position)
        this.chassis.physical.body.setRotation(quaternion)
        this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
    }

    flip()
    {
        const up = new THREE.Vector3(0, 1, 0)
        const sidewardDot = up.dot(this.sideward)
        const forwardDot = up.dot(this.forward)
        const upwarddDot = up.dot(this.upward)
        
        const sidewardAbsolute = Math.abs(sidewardDot)
        const forwardAbsolute = Math.abs(forwardDot)
        const upwarddAbsolute = Math.abs(upwarddDot)

        const impulse = new THREE.Vector3(0, 1, 0).multiplyScalar(this.flipForce * this.chassis.mass)
        this.chassis.physical.body.applyImpulse(impulse)

        // Upside down
        if(upwarddAbsolute > sidewardAbsolute && upwarddAbsolute > forwardAbsolute)
        {
            const torqueX = 0.8 * this.chassis.mass
            const torque = new THREE.Vector3(torqueX, 0, 0)
            torque.applyQuaternion(this.chassis.physical.body.rotation())
            this.chassis.physical.body.applyTorqueImpulse(torque)
        }
        // On the side
        else
        {
            const torqueX = sidewardDot * 0.4 * this.chassis.mass
            const torqueZ = - forwardDot * 0.8 * this.chassis.mass
            const torque = new THREE.Vector3(torqueX, 0, torqueZ)
            torque.applyQuaternion(this.chassis.physical.body.rotation())
            this.chassis.physical.body.applyTorqueImpulse(torque)
        }
    }


    updatePrePhysics()
    {
        // Engine force
        const maxSpeed = this.maxSpeed + (this.maxSpeed * (this.boostMultiplier - 1) * this.game.player.boosting)
        const overflowSpeed = Math.max(0, this.absoluteSpeed - maxSpeed)
        let engineForce = (this.game.player.accelerating * (1 + this.game.player.boosting * this.boostMultiplier)) * this.engineForceAmplitude / (1 + overflowSpeed)

        // Brake
        let brake = this.game.player.braking

        if(!this.game.player.braking && Math.abs(this.game.player.accelerating) < 0.1)
            brake = this.idleBrake
        
        if(this.absoluteSpeed > 0.5)
        {
            if(
                this.absoluteSpeed > 0.5 &&
                (
                    (this.game.player.accelerating > 0 && !this.goingForward) ||
                    (this.game.player.accelerating < 0 && this.goingForward)
                )
            )
            {
                brake = this.reverseBrake
                engineForce = 0
            }
        }

        brake *= this.brakeAmplitude * this.game.ticker.deltaScaled

        // Update wheels
        this.controller.setWheelSteering(0, this.game.player.steering * this.steeringAmplitude)
        this.controller.setWheelSteering(1, this.game.player.steering * this.steeringAmplitude)

        for(let i = 0; i < 4; i++)
        {
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, engineForce)
            this.controller.setWheelSuspensionRestLength(i, this.suspensionsHeights[this.game.player.suspensions[i]])
            this.controller.setWheelSuspensionStiffness(i, this.suspensionsStiffness[this.game.player.suspensions[i]])
        }

        // Tornado
        this.tornado.apply()
        
        // Update controller
        this.controller.updateVehicle(this.game.ticker.delta)
    }

    updatePostPhysics()
    {
        // Various measures
        const newPosition = new THREE.Vector3().copy(this.chassis.physical.body.translation())
        this.velocity = newPosition.clone().sub(this.position)
        this.direction = this.velocity.clone().normalize()
        this.position.copy(newPosition)
        this.quaternion.copy(this.chassis.physical.body.rotation())
        this.sideward.set(0, 0, 1).applyQuaternion(this.quaternion)
        this.upward.set(0, 1, 0).applyQuaternion(this.quaternion)
        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)
        this.speed = this.controller.currentVehicleSpeed()
        this.absoluteSpeed = Math.abs(this.speed)
        this.goingForward = this.direction.dot(this.forward) > 0.5

        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels.items[i]
            wheel.inContact = this.controller.wheelIsInContact(i)
            wheel.contactPoint = this.controller.wheelContactPoint(i)
            wheel.suspensionLength = this.controller.wheelSuspensionLength(i)
        }

        this.stop.test()
        this.upsideDown.test()
    }

    activate()
    {
        this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setEnabled(true)
    }

    deactivate()
    {
        this.chassis.physical.body.setEnabled(false)
    }
}