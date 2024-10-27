import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { Events } from './Events.js'

export class Vehicle
{
    constructor()
    {
        this.game = new Game()
        
        this.events = new Events()

        this.setChassis()

        this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)

        this.sideward = new THREE.Vector3(1, 0, 0)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.forward = new THREE.Vector3(0, 0, 1)
        this.position = new THREE.Vector3()
        this.speed = 0
        this.absoluteSpeed = 0
        this.upsideDownRatio = 0

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🚗 Vehicle',
                expanded: true,
            })
        }

        this.setWheels()
        this.setStop()
        this.setFlip()
        this.setUnstuck()
        this.setReset()
        this.setHydraulics()

        this.game.time.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)
        this.game.time.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 4)
    }

    setChassis()
    {
        const visual = new THREE.Mesh(
            new THREE.BoxGeometry(1.5 * 2, 0.5 * 2, 1 * 2),
            new THREE.MeshNormalNodeMaterial({ wireframe: true })
        )
        this.game.world.scene.add(visual)
        this.chassis = this.game.physics.addEntity(
            {
                type: 'dynamic',
                position: { x: 0, y: 5, z: 0 },
                // rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Euler(1, 0, 0.2), Math.PI * 0.5),
                colliders: [ { shape: 'cuboid', parameters: [ 1.5, 0.5, 1 ] } ],
                canSleep: false,
            },
            visual
        )
        // this.chassis.physical.body.applyTorqueImpulse({ x: 0, y: 5, z: 0 })
    }

    setWheels()
    {
        // Setup
        this.wheels = {}
        this.wheels.items = []
        this.wheels.engineForce = 0
        this.wheels.engineForceMax = 350
        this.wheels.engineBoostMultiplier = 2.5
        this.wheels.steering = 0
        this.wheels.steeringMax = 0.5
        this.wheels.visualSteering = 0
        this.wheels.inContact = 0
        this.wheels.brakeStrength = 15
        this.wheels.brakePerpetualStrength = 2.88

        // Geometry
        const wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 8)
        wheelGeometry.rotateX(Math.PI * 0.5)

        // Create wheels
        for(let i = 0; i < 4; i++)
        {
            // Default wheel with random parameters
            this.controller.addWheel(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), 1, 1)

            // Visual
            const visual = new THREE.Mesh(
                wheelGeometry,
                new THREE.MeshNormalNodeMaterial({ flatShading: true })
            )
            visual.rotation.reorder('YXZ')
            this.chassis.visual.add(visual)
            this.wheels.items.push({ visual, basePosition: new THREE.Vector3() })
        }

        // Settings
        this.wheels.settings = {
            offset: { x: 0.8, y: -0.4, z: 0.85 }, // No default
            radius: 0.5,                          // No default
            directionCs: { x: 0, y: -1, z: 0 },   // Suspension direction
            axleCs: { x: 0, y: 0, z: 1 },         // Rotation axis
            frictionSlip: 0.9,                    // 10.5
            maxSuspensionForce: 100,              // 100
            maxSuspensionTravel: 2,               // 5
            sideFrictionStiffness: 0.6,           // 1
            suspensionCompression: 2,             // 0.83
            suspensionRelaxation: 1.88,           // 0.88
            suspensionStiffness: 30,              // 5.88
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
                this.controller.setWheelSuspensionStiffness(i, this.wheels.settings.suspensionStiffness)

                wheel.visual.scale.set(this.wheels.settings.radius, this.wheels.settings.radius, 1)
                wheel.visual.position.copy(wheel.basePosition)

                i++
            }
        }

        this.wheels.updateSettings()

        // Debug
        if(this.game.debug.active)
        {
            const panel = this.debugPanel.addFolder({
                title: '🛞 Wheels',
                expanded: true,
            })

            panel.addBinding(this.wheels.settings, 'offset', { min: -1, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'radius', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'frictionSlip', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'maxSuspensionForce', { min: 0, max: 1000, step: 1 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'maxSuspensionTravel', { min: 0, max: 2, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'sideFrictionStiffness', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'suspensionCompression', { min: 0, max: 10, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'suspensionRelaxation', { min: 0, max: 10, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'suspensionStiffness', { min: 0, max: 100, step: 0.1 }).on('change', this.wheels.updateSettings)
            
            panel.addBinding(this.wheels, 'steeringMax', { min: 0, max: Math.PI * 0.5, step: 0.01 })
            panel.addBinding(this.wheels, 'brakeStrength', { min: 0, max: 1, step: 0.01 })
            panel.addBinding(this.wheels, 'brakePerpetualStrength', { min: 0, max: 0.2, step: 0.01 })
            panel.addBinding(this.wheels, 'engineForceMax', { min: 0, max: 10, step: 0.01 })
            panel.addBinding(this.wheels, 'engineBoostMultiplier', { min: 0, max: 5, step: 0.01 })
        }
    }

    setStop()
    {
        this.stop = {}
        this.stop.active = true
        this.stop.lowEdge = 0.04
        this.stop.highEdge = 0.7
        
        this.stop.activate = () =>
        {
            this.stop.active = true
            this.events.trigger('stop')
        }
        
        this.stop.deactivate = () =>
        {
            this.stop.active = false
            this.events.trigger('start')
        }
    }

    setFlip()
    {
        this.flip = {}
        this.flip.active = false
        this.flip.edge = 0.3
        
        this.flip.activate = () =>
        {
            this.flip.active = true
            this.events.trigger('flip')
        }
        
        this.flip.deactivate = () =>
        {
            this.flip.active = false
            this.events.trigger('unflip')
        }
    }

    setUnstuck()
    {
        this.unstuck = {}
        this.unstuck.duration = 3
        this.unstuck.timeout = null
        this.unstuck.force = 8

        this.unstuck.test = () =>
        {
            if(this.flip.active && this.stop.active)
            {
                clearTimeout(this.unstuck.timeout)
                this.unstuck.timeout = setTimeout(() =>
                {
                    if(this.flip.active && this.stop.active)
                        this.unstuck.activate()
                }, 1000)
            }
        }

        this.unstuck.activate = () =>
        {
            const up = new THREE.Vector3(0, 1, 0)
            const sidewardDot = up.dot(this.sideward)
            const forwardDot = up.dot(this.forward)
            const upwarddDot = up.dot(this.upward)
            
            const sidewardAbsolute = Math.abs(sidewardDot)
            const forwardAbsolute = Math.abs(forwardDot)
            const upwarddAbsolute = Math.abs(upwarddDot)

            const impulse = new THREE.Vector3(0, 1, 0).multiplyScalar(this.unstuck.force * this.chassis.physical.body.mass())
            this.chassis.physical.body.applyImpulse(impulse)

            // Upside down
            if(upwarddAbsolute > sidewardAbsolute && upwarddAbsolute > forwardAbsolute)
            {
                const torqueX = 0.8 * this.chassis.physical.body.mass()
                const torque = new THREE.Vector3(torqueX, 0, 0)
                torque.applyQuaternion(this.chassis.physical.body.rotation())
                this.chassis.physical.body.applyTorqueImpulse(torque)
            }
            // On the side
            else
            {
                const torqueX = forwardDot * 0.4 * this.chassis.physical.body.mass()
                const torqueZ = - sidewardDot * 0.8 * this.chassis.physical.body.mass()
                const torque = new THREE.Vector3(torqueX, 0, torqueZ)
                torque.applyQuaternion(this.chassis.physical.body.rotation())
                this.chassis.physical.body.applyTorqueImpulse(torque)
            }
        }

        this.events.on('flip', () =>
        {
            this.unstuck.test()
        })

        this.events.on('stop', () =>
        {
            this.unstuck.test()
        })

        if(this.game.debug.active)
        {
            const panel = this.debugPanel.addFolder({
                title: '🔄 Unstuck',
                expanded: true,
            })

            panel.addBinding(this.unstuck, 'force', { min: 0, max: 20, step: 0.01 })
        }
    }

    setReset()
    {
        this.reset = {}
        this.reset.activate = () =>
        {
            this.chassis.physical.body.setTranslation({ x: 2, y: 4, z: 2 })
            this.chassis.physical.body.setRotation({ w: 1, x: 0, y: 0, z: 0 })
            this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
            this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
        }

        this.game.inputs.events.on('reset', (_down) =>
        {
            if(_down)
                this.reset.activate()
        })
    }

    setHydraulics()
    {
        this.hydraulics = {}
        this.hydraulics.low = 0.125
        this.hydraulics.mid = 0.5
        this.hydraulics.high = 1

        for(let i = 0; i < 4; i++)
            this.controller.setWheelSuspensionRestLength(i, this.hydraulics.low)

        this.hydraulics.update = () =>
        {
            const activeHydraulics = [
                this.game.inputs.keys.hydraulics || this.game.inputs.keys.hydraulicsFront || this.game.inputs.keys.hydraulicsRight || this.game.inputs.keys.hydraulicsFrontRight, // front right
                this.game.inputs.keys.hydraulics || this.game.inputs.keys.hydraulicsFront || this.game.inputs.keys.hydraulicsLeft || this.game.inputs.keys.hydraulicsFrontLeft, // front left
                this.game.inputs.keys.hydraulics || this.game.inputs.keys.hydraulicsBack || this.game.inputs.keys.hydraulicsRight || this.game.inputs.keys.hydraulicsBackRight, // back right
                this.game.inputs.keys.hydraulics || this.game.inputs.keys.hydraulicsBack || this.game.inputs.keys.hydraulicsLeft || this.game.inputs.keys.hydraulicsBackLeft, // back left
            ]

            const restLength = this.game.inputs.keys.hydraulics ? this.hydraulics.high :this.hydraulics.mid
            
            for(let i = 0; i < 4; i++)
                this.controller.setWheelSuspensionRestLength(i, activeHydraulics[i] ? restLength : this.hydraulics.low)
        }

        this.game.inputs.events.on('hydraulics', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsFront', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsBack', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsRight', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsLeft', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsFrontLeft', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsFrontRight', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsBackRight', this.hydraulics.update)
        this.game.inputs.events.on('hydraulicsBackLeft', this.hydraulics.update)


        // Debug
        if(this.game.debug.active)
        {
            const panel = this.debugPanel.addFolder({
                title: '⬆️ Hydraulics',
                expanded: true,
            })

            panel.addBinding(this.hydraulics, 'low', { min: 0, max: 2, step: 0.01 }).on('change', this.hydraulics.update)
            panel.addBinding(this.hydraulics, 'mid', { min: 0, max: 2, step: 0.01 }).on('change', this.hydraulics.update)
            panel.addBinding(this.hydraulics, 'high', { min: 0, max: 2, step: 0.01 }).on('change', this.hydraulics.update)
        }
    }

    updatePrePhysics()
    {
        // Wheels
        this.wheels.engineForce = 0
        if(this.game.inputs.keys.up)
            this.wheels.engineForce += this.wheels.engineForceMax
        if(this.game.inputs.keys.down)
            this.wheels.engineForce -= this.wheels.engineForceMax

        if(this.game.inputs.keys.boost)
            this.wheels.engineForce *= this.wheels.engineBoostMultiplier

        this.wheels.steering = 0
        if(this.game.inputs.keys.right)
            this.wheels.steering -= this.wheels.steeringMax
        if(this.game.inputs.keys.left)
            this.wheels.steering += this.wheels.steeringMax
        this.controller.setWheelSteering(0, this.wheels.steering)
        this.controller.setWheelSteering(1, this.wheels.steering)

        let brake = this.wheels.brakePerpetualStrength
        if(this.game.inputs.keys.brake)
        {
            this.wheels.engineForce *= 0.5
            brake = this.wheels.brakeStrength
        }

        for(let i = 0; i < 4; i++)
        {
            this.controller.setWheelBrake(i, brake * this.game.time.deltaScaled)
            this.controller.setWheelEngineForce(i, this.wheels.engineForce * this.game.time.deltaScaled)
        }
    }

    updatePostPhysics()
    {
        // Various measures
        this.position.copy(this.chassis.physical.body.translation())
        this.sideward.set(1, 0, 0).applyQuaternion(this.chassis.physical.body.rotation())
        this.upward.set(0, 1, 0).applyQuaternion(this.chassis.physical.body.rotation())
        this.forward.set(0, 0, 1).applyQuaternion(this.chassis.physical.body.rotation())
        this.speed = this.controller.currentVehicleSpeed()
        this.absoluteSpeed = Math.abs(this.speed)
        this.upsideDownRatio = this.upward.dot(new THREE.Vector3(0, - 1, 0)) * 0.5 + 0.5
        
        // Wheels
        this.wheels.visualSteering += (this.wheels.steering - this.wheels.visualSteering) * this.game.time.deltaScaled * 16

        this.wheels.inContact = 0

        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels.items[i]

            if(!this.game.inputs.keys.brake)
                wheel.visual.rotation.z -= (this.speed * this.game.time.deltaScaled) / this.wheels.settings.radius

            if(i === 0 || i === 1)
                wheel.visual.rotation.y = this.wheels.visualSteering

            const suspensionY = wheel.basePosition.y - this.controller.wheelSuspensionLength(i)
            wheel.visual.position.y += (suspensionY - wheel.visual.position.y) * 25 * this.game.time.deltaScaled

            if(this.controller.wheelIsInContact(i))
                this.wheels.inContact++
        }

        // Stop
        if(this.absoluteSpeed < this.stop.lowEdge)
        {
            if(!this.stop.active)
                this.stop.activate()
        }
        else if(this.absoluteSpeed > this.stop.highEdge)
        {
            if(this.stop.active)
                this.stop.deactivate()
        }

        // Flip
        if(this.upsideDownRatio > this.flip.edge)
        {
            if(!this.flip.active)
                this.flip.activate()
        }
        else
        {
            if(this.flip.active)
                this.flip.deactivate()
        }
    }
}