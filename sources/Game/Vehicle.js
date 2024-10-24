import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Vehicle
{
    constructor()
    {
        this.game = new Game()

        this.setChassis()

        this.controller = this.game.physics.world.createVehicleController(this.chassis.physical.body)

        this.up = new THREE.Vector3(0, 1, 0)
        this.position = new THREE.Vector3()
        this.positionDelta = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this.speed = 0
        this.upsideDownRatio = 0
        this.stopped = true
        this.stoppedTime = 0

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🚗 Vehicle',
                expanded: true,
            })
        }

        this.setWheels()
        this.setJump()
        this.setReset()

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
            new THREE.BoxGeometry(1 * 2, 0.5 * 2, 1.5 * 2),
            new THREE.MeshNormalMaterial({ wireframe: true })
        )
        this.game.world.scene.add(visual)
        this.chassis = this.game.physics.addEntity(
            {
                type: 'dynamic',
                shape: 'cuboid',
                position: { x: 0, y: 1, z: 0 },
                colliders: [ { shape: 'cuboid', parameters: [ 1, 0.5, 1.5 ] } ],
                canSleep: false,
                // linearDamping: 0.2
            },
            visual
        )
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.settings = {
            offset: { x: 0.75, y: -0.4, z: 0.8 }, // No default
            radius: 0.5,                          // No default
            directionCs: { x: 0, y: -1, z: 0 },   // Suspension direction
            axleCs: { x: -1, y: 0, z: 0 },        // Rotation axis
            frictionSlip: 0.9,                    // 10.5
            maxSuspensionForce: 100,              // 100
            maxSuspensionTravel: 2,               // 5
            sideFrictionStiffness: 0.6,           // 1
            suspensionCompression: 2,             // 0.83
            suspensionRelaxation: 1.88,           // 0.88
            suspensionRestLength: 0.125,          // No default
            suspensionStiffness: 30,              // 5.88
        }
        this.wheels.items = []
        this.wheels.engineForce = 0
        this.wheels.engineForceMax = 6
        this.wheels.engineBoostMultiplier = 2.5
        this.wheels.steering = 0
        this.wheels.steeringMax = 0.5
        this.wheels.visualSteering = 0
        this.wheels.inContact = 0
        this.wheels.brakeStrength = 0.21
        this.wheels.brakePerpetualStrength = 0.04

        for(let i = 0; i < 4; i++)
        {
            // Physical
            this.controller.addWheel({ x: 0, y: 0, z: 0 }, this.wheels.settings.directionCs, this.wheels.settings.axleCs, this.wheels.settings.suspensionRestLength, this.wheels.settings.radius)

            // Visual
            const visual = new THREE.Mesh(
                new THREE.CylinderGeometry(1, 1, 0.5, 8),
                new THREE.MeshNormalMaterial({ flatShading: true })
            )
            visual.geometry.rotateZ(Math.PI * 0.5)
            visual.rotation.reorder('YXZ')
            this.chassis.visual.add(visual)
            this.wheels.items.push({ visual, basePosition: { x: 0, y: 0, z: 0 } })
        }

        this.wheels.updateSettings = () =>
        {
            const wheelsPositions = [
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(  this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y,   this.wheels.settings.offset.z),
                new THREE.Vector3(- this.wheels.settings.offset.x, this.wheels.settings.offset.y, - this.wheels.settings.offset.z),
            ]
            
            let i = 0
            for(const wheel of this.wheels.items)
            {
                wheel.basePosition.x = wheelsPositions[i].x
                wheel.basePosition.y = wheelsPositions[i].y
                wheel.basePosition.z = wheelsPositions[i].z
                
                this.controller.setWheelRadius(i, this.wheels.settings.radius)
                this.controller.setWheelChassisConnectionPointCs(i, wheel.basePosition)
                this.controller.setWheelFrictionSlip(i, this.wheels.settings.frictionSlip)
                this.controller.setWheelMaxSuspensionForce(i, this.wheels.settings.maxSuspensionForce)
                this.controller.setWheelMaxSuspensionTravel(i, this.wheels.settings.maxSuspensionTravel)
                this.controller.setWheelSideFrictionStiffness(i, this.wheels.settings.sideFrictionStiffness)
                this.controller.setWheelSuspensionCompression(i, this.wheels.settings.suspensionCompression)
                this.controller.setWheelSuspensionRelaxation(i, this.wheels.settings.suspensionRelaxation)
                this.controller.setWheelSuspensionRestLength(i, this.wheels.settings.suspensionRestLength)
                this.controller.setWheelSuspensionStiffness(i, this.wheels.settings.suspensionStiffness)

                wheel.visual.scale.set(1, this.wheels.settings.radius, this.wheels.settings.radius)
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
            panel.addBinding(this.wheels.settings, 'suspensionRestLength', { min: 0, max: 1, step: 0.01 }).on('change', this.wheels.updateSettings)
            panel.addBinding(this.wheels.settings, 'suspensionStiffness', { min: 0, max: 100, step: 0.1 }).on('change', this.wheels.updateSettings)
            
            panel.addBinding(this.wheels, 'steeringMax', { min: 0, max: Math.PI * 0.5, step: 0.01 })
            panel.addBinding(this.wheels, 'brakeStrength', { min: 0, max: 1, step: 0.01 })
            panel.addBinding(this.wheels, 'brakePerpetualStrength', { min: 0, max: 0.2, step: 0.01 })
            panel.addBinding(this.wheels, 'engineForceMax', { min: 0, max: 10, step: 0.01 })
            panel.addBinding(this.wheels, 'engineBoostMultiplier', { min: 0, max: 5, step: 0.01 })
        }
    }

    setJump()
    {
        this.jump = {}
        this.jump.force = 8
        this.jump.turningTorque = 2
        this.jump.recoverTorque = 4
        this.jump.jumpUp = () =>
        {
            if(this.wheels.inContact > 0)
            {
                const impulse = this.up.clone().multiplyScalar(this.jump.force * this.chassis.physical.body.mass())
                this.chassis.physical.body.applyImpulse(impulse)

                let torqueY = 0
                if(this.game.inputs.keys.left)
                    torqueY += this.jump.turningTorque
                else if(this.game.inputs.keys.right)
                    torqueY -= this.jump.turningTorque
                this.chassis.physical.body.applyTorqueImpulse({ x: 0, y: torqueY, z: 0 })
            }
        }

        this.jump.recover = () =>
        {
                const impulse = new THREE.Vector3(0, 1, 0).multiplyScalar(this.jump.force * this.chassis.physical.body.mass())
                this.chassis.physical.body.applyImpulse(impulse)

                const torque = this.jump.recoverTorque * this.upsideDownRatio
                this.chassis.physical.body.applyTorqueImpulse({ x: torque * 0.5, y: 0, z: torque })
        }

        this.game.inputs.events.on('jump', (_down) =>
        {
            if(_down)
                this.jump.jumpUp()
        })
        
        // Debug
        if(this.game.debug.active)
        {
            const panel = this.debugPanel.addFolder({
                title: '⬆️ Jump',
                expanded: true,
            })

            panel.addBinding(this.jump, 'force', { min: 0, max: 20, step: 0.01 })
            panel.addBinding(this.jump, 'turningTorque', { min: 0, max: 10, step: 0.01 })
            panel.addBinding(this.jump, 'recoverTorque', { min: 0, max: 10, step: 0.01 })
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
        this.controller.setWheelSteering(2, this.wheels.steering)

        let brake = this.wheels.brakePerpetualStrength
        if(this.game.inputs.keys.brake)
        {
            this.wheels.engineForce *= 0.5
            brake = this.wheels.brakeStrength
        }

        for(let i = 0; i < 4; i++)
        {
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, this.wheels.engineForce)
        }
    }

    updatePostPhysics()
    {
        // Wheels
        this.wheels.visualSteering += (this.wheels.steering - this.wheels.visualSteering) * this.game.time.delta * 16

        this.wheels.inContact = 0

        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels.items[i]

            wheel.visual.rotation.x += this.wheels.engineForce * 1.5 * this.game.time.delta

            if(i === 0 || i === 2)
                wheel.visual.rotation.y = this.wheels.visualSteering

            wheel.visual.position.y = wheel.basePosition.y - this.controller.wheelSuspensionLength(i)

            if(this.controller.wheelIsInContact(i))
                this.wheels.inContact++
        }

        // Various measures
        const newPosition = this.chassis.physical.body.translation()
        this.positionDelta = this.positionDelta.copy(newPosition).sub(this.position)
        this.position.copy(newPosition)

        this.up.set(0, 1, 0).applyQuaternion(this.chassis.physical.body.rotation())
        this.speed = this.positionDelta.length() / this.game.time.delta // Units per seconds
        this.upsideDownRatio = this.up.dot(new THREE.Vector3(0, - 1, 0)) * 0.5 + 0.5

        // Stopped
        if(this.speed < 0.05)
        {
            if(!this.stopped)
            {
                this.stopped = true
                this.stoppedTime = this.game.time.elapsed
            }
        }
        if(this.speed > 0.1)
        {
            if(this.stopped)
            {
                this.stopped = false
            }
        }

        // Stuck
        if(
            this.stopped &&
            this.game.time.elapsed - this.stoppedTime > 1 &&
            this.upsideDownRatio > 0.3
        )
        {
            if(!this.stuck)
            {
                this.stuck = true
                this.jump.recover()
            }
        }
        else
        {
            if(this.stuck)
            {
                this.stuck = false
            }
        }
    }
}