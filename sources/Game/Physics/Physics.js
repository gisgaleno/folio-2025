import { Game } from '../Game.js'

export class Physics
{
    constructor()
    {
        this.game = new Game()

        this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
        this.entities = new Map()
        this.entitiesKey = 0

        this.game.time.events.on('tick', () =>
        {
            this.update()
        }, 2)
    }

    addEntity(_physicalDescription = null, _visual = null)
    {
        const entity = {
            physical: _physicalDescription ? this.getPhysical(_physicalDescription) : null,
            visual: _visual
        }
        this.entitiesKey++
        this.entities.set(this.entitiesKey, entity)

        return entity
    }

    getPhysical(_physicalDescription)
    {
        const physical = {}

        // Body
        let rigidBodyDesc = RAPIER.RigidBodyDesc
        
        if(_physicalDescription.type === 'dynamic' || typeof _physicalDescription.type === 'undefined')
            rigidBodyDesc = rigidBodyDesc.dynamic()
        else if(_physicalDescription.type === 'fixed')
            rigidBodyDesc = rigidBodyDesc.fixed()

        if(typeof _physicalDescription.position !== 'undefined')
            rigidBodyDesc.setTranslation(_physicalDescription.position.x, _physicalDescription.position.y, _physicalDescription.position.z)

        if(typeof _physicalDescription.rotation !== 'undefined')
            rigidBodyDesc.setRotation(_physicalDescription.rotation)

        if(typeof _physicalDescription.canSleep !== 'undefined')
            rigidBodyDesc.setCanSleep(_physicalDescription.canSleep)

        if(typeof _physicalDescription.linearDamping !== 'undefined')
            rigidBodyDesc.setLinearDamping(_physicalDescription.linearDamping)

        physical.body = this.world.createRigidBody(rigidBodyDesc)


        // Coliders
        physical.colliders = []
        for(const _colliderDescription of _physicalDescription.colliders)
        {
            let colliderDescription = RAPIER.ColliderDesc

            if(_colliderDescription.shape === 'cuboid')
                colliderDescription = colliderDescription.cuboid(..._colliderDescription.parameters)

            if(_colliderDescription.position)
                colliderDescription = colliderDescription.setTranslation(_colliderDescription.position.x, _colliderDescription.position.y, _colliderDescription.position.z)

            const collider = this.world.createCollider(colliderDescription, physical.body)
            physical.colliders.push(collider)
        }

        return physical
    }

    update()
    {
        this.world.timestep = this.game.time.delta * 2
        this.world.step()

        this.world.vehicleControllers.forEach((_vehicleController) =>
        {
            _vehicleController.updateVehicle(this.world.timestep)
        })

        this.entities.forEach((_entity) =>
        {
            if(_entity.visual)
            {
                _entity.visual.position.copy(_entity.physical.body.translation())
                _entity.visual.quaternion.copy(_entity.physical.body.rotation())
            }
        })
    }
}