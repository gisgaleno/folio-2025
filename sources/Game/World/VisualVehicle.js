import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Track } from '../GroundData/Track.js'
import { Trails } from '../Trails.js'
import { remapClamp } from '../utilities/maths.js'

export class VisualVehicle
{
    constructor()
    {
        this.game = Game.getInstance()
        
        this.setParts()
        this.setMainGroundTrack()
        this.setWheels()
        this.setBlinkers()
        this.setAntenna()
        this.setBoostTrails()
        this.setScreenPosition()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 6)
    }

    setParts()
    {
        this.parts = {}

        this.game.resources.vehicle.scene.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.receiveShadow = true
                child.castShadow = true
                child.material.shadowSide = THREE.BackSide
            }
        })

        // Chassis
        this.parts.chassis = this.game.resources.vehicle.scene.getObjectByName('chassis')
        this.parts.chassis.rotation.reorder('YXZ')
        this.game.materials.updateObject(this.parts.chassis)
        this.game.scene.add(this.parts.chassis)

        // Blinker left
        this.parts.blinkerLeft = this.parts.chassis.getObjectByName('blinkerLeft')
        this.parts.blinkerLeft.visible = false

        // Blinker right
        this.parts.blinkerRight = this.parts.chassis.getObjectByName('blinkerRight')
        this.parts.blinkerRight.visible = false

        // Stop lights
        this.parts.stopLights = this.parts.chassis.getObjectByName('stopLights')
        this.parts.stopLights.visible = false

        // Wheel
        this.parts.wheelContainer = this.game.resources.vehicle.scene.getObjectByName('wheelContainer')
        this.game.materials.updateObject(this.parts.wheelContainer)

        // Antenna
        this.parts.antenna = this.parts.chassis.getObjectByName('antenna')
    }

    setMainGroundTrack()
    {
        this.mainGroundTrack = this.game.groundData.addTrack(new Track(1.5, 'g'))

    }

    setWheels()
    {
        // Setup
        this.wheels = {}
        this.wheels.items = []
        this.wheels.steering = 0

        // Create wheels
        for(let i = 0; i < 4; i++)
        {
            const wheel = {}

            // Clone group
            wheel.container = this.parts.wheelContainer.clone(true)
            this.parts.chassis.add(wheel.container)

            // Suspension
            wheel.suspension = wheel.container.getObjectByName('wheelSuspension')
            
            // Cylinder (actual wheel)
            wheel.cylinder = wheel.container.getObjectByName('wheelCylinder')
            wheel.cylinder.position.set(0, 0, 0)
            
            if(i === 0 || i === 2)
                wheel.container.rotation.y = Math.PI

            // Add track to ground data
            wheel.groundTrack = this.game.groundData.addTrack(new Track(0.5, 'r'))

            this.wheels.items.push(wheel)
        }
    }

    setBlinkers()
    {
        let running = false
        let interval = null
        let on = false

        const start = () =>
        {
            if(running)
                return

            running = true
            on = true

            this.parts.blinkerLeft.visible = this.game.inputs.actions.get('left').active ? on : false
            this.parts.blinkerRight.visible = this.game.inputs.actions.get('right').active ? on : false

            interval = setInterval(blink, 400)
        }

        const blink = () =>
        {
            on = !on

            this.parts.blinkerLeft.visible = this.game.inputs.actions.get('left').active ? on : false
            this.parts.blinkerRight.visible = this.game.inputs.actions.get('right').active ? on : false

            if(!this.game.inputs.actions.get('left').active && !this.game.inputs.actions.get('right').active && !on)
            {
                clearInterval(interval)
                running = false
            }
        }

        this.game.inputs.events.on('left', (active) =>
        {
            if(active.active)
                start()
        })

        this.game.inputs.events.on('right', (active) =>
        {
            if(active.active)
                start()
        })
    }

    setAntenna()
    {
        if(!this.parts.antenna)
            return

        this.antenna = {}
        this.antenna.target = new THREE.Vector3(0, 2, 0)
        this.antenna.target = new THREE.Vector3(0, 2, 0)
        this.antenna.object = this.parts.antenna
        this.antenna.head = this.game.resources.vehicle.scene.getObjectByName('antennaHead')
        this.antenna.headAxle = this.antenna.head.children[0]
        this.antenna.headReference = this.antenna.object.getObjectByName('antennaHeadReference')

        this.game.materials.updateObject(this.antenna.head)
        this.game.scene.add(this.antenna.head)
    }

    setBoostTrails()
    {
        this.boostTrails = {}
        this.boostTrails.instance = new Trails()

        this.boostTrails.leftReference = new THREE.Object3D()
        this.boostTrails.leftReference.position.set(-1.28, 0.1, -0.55)
        this.parts.chassis.add(this.boostTrails.leftReference)

        this.boostTrails.left = this.boostTrails.instance.create()
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)
    
        this.boostTrails.rightReference = new THREE.Object3D()
        this.boostTrails.rightReference.position.set(-1.28, 0.1, 0.55)
        this.parts.chassis.add(this.boostTrails.rightReference)

        this.boostTrails.right = this.boostTrails.instance.create()
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
    }

    setScreenPosition()
    {
        this.screenPosition = new THREE.Vector2(0, 0)
    }

    update()
    {
        const physicalVehicle = this.game.physicalVehicle
        
        // Chassis
        this.parts.chassis.position.copy(physicalVehicle.position)
        this.parts.chassis.quaternion.copy(physicalVehicle.quaternion)
        
        // Wheels
        this.wheels.steering += ((this.game.player.steering * physicalVehicle.steeringAmplitude) - this.wheels.steering) * this.game.ticker.deltaScaled * 16

        for(let i = 0; i < 4; i++)
        {
            const visualWheel = this.wheels.items[i]
            const physicalWheel = physicalVehicle.wheels.items[i]

            // visualWheel.container.position.copy(physicalWheel.basePosition)

            if(!this.game.inputs.actions.get('brake').active || this.game.inputs.actions.get('forward').active || this.game.inputs.actions.get('backward').active)
            {
                if(!physicalVehicle.stop.active)
                {
                    if(i === 0 || i === 2)
                        visualWheel.cylinder.rotation.z += (physicalVehicle.speed * this.game.ticker.deltaScaled) / physicalVehicle.wheels.settings.radius
                    else
                        visualWheel.cylinder.rotation.z -= (physicalVehicle.speed * this.game.ticker.deltaScaled) / physicalVehicle.wheels.settings.radius
                }
            }

            if(i === 0)
                visualWheel.container.rotation.y = Math.PI + this.wheels.steering

            if(i === 1)
                visualWheel.container.rotation.y = this.wheels.steering
  
            const suspensionLength = physicalWheel.suspensionLength
            let wheelY = physicalWheel.basePosition.y - suspensionLength
            wheelY = Math.min(wheelY, -0.5)

            visualWheel.container.position.x = physicalWheel.basePosition.x
            visualWheel.container.position.y += (wheelY - visualWheel.container.position.y) * 25 * this.game.ticker.deltaScaled
            visualWheel.container.position.z = physicalWheel.basePosition.z

            const suspensionScale = Math.abs(visualWheel.container.position.y) - 0.5
            visualWheel.suspension.scale.y = suspensionScale

            // Ground tracks
            visualWheel.groundTrack.update(physicalWheel.contactPoint, physicalWheel.inContact)
        }

        // Main ground track
        this.mainGroundTrack.update(physicalVehicle.position, physicalVehicle.position.y < 1.5)

        // Antenna
        if(this.antenna)
        {
            const angle = Math.atan2(this.antenna.target.x - physicalVehicle.position.x, this.antenna.target.z - physicalVehicle.position.z)
            this.antenna.object.rotation.y = angle - this.parts.chassis.rotation.y
            this.antenna.headReference.getWorldPosition(this.antenna.head.position)
            this.antenna.head.lookAt(this.antenna.target)

            const antennaTargetDistance = this.antenna.target.distanceTo(physicalVehicle.position)
            
            const antennaRotationSpeed = remapClamp(antennaTargetDistance, 50, 5, 1, 10)
            this.antenna.headAxle.rotation.z += this.game.ticker.deltaScaled * antennaRotationSpeed
        }

        // Stop lights
        if(this.game.player.braking)
            this.parts.stopLights.visible = true
        else
            this.parts.stopLights.visible = false

        // Boost trails
        const trailAlpha = physicalVehicle.goingForward && this.game.player.boosting && this.game.player.accelerating > 0 ? 1 : 0
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)
        this.boostTrails.left.alpha = trailAlpha
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
        this.boostTrails.right.alpha = trailAlpha

        // Screen position
        const vector = new THREE.Vector3()
        vector.setFromMatrixPosition(this.parts.chassis.matrixWorld)
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}