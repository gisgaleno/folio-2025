import { Game } from './Game.js'
import { remapClamp } from './utilities/maths.js'

export class Entities
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = new Map()
        this.key = 0

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 3)
    }

    add(_physicalDescription = null, _visual = null)
    {
        const entity = {
            physical: _physicalDescription ? this.game.physics.getPhysical(_physicalDescription) : null,
            visual: _visual
        }
        this.key++
        this.list.set(this.key, entity)

        if(_visual)
        {
            this.game.scene.add(_visual)

            // If sleeping or fixed apply transform directly
            if(_physicalDescription.sleeping || _physicalDescription.type === 'fixed')
            {
                entity.visual.position.copy(entity.physical.body.translation())
                entity.visual.quaternion.copy(entity.physical.body.rotation())
            }
        }

        return entity
    }

    addFromModels(_physicalModel, _visualModel, _physicalDescription = {})
    {
        // Colliders
        const colliders = []

        for(const physical of _physicalModel.children)
        {
            let collidersOverload = {}
            if(typeof _physicalDescription.collidersOverload !== 'undefined')
                collidersOverload = _physicalDescription.collidersOverload

            const collider = {
                position: physical.position,
                quaternion: physical.quaternion,
                ...collidersOverload
            }
            if(physical.name.match(/^trimesh/i))
            {
                collider.shape = 'trimesh'
                collider.parameters = [ physical.geometry.attributes.position.array, physical.geometry.index.array ]
            }
            else if(physical.name.match(/^cub/i))
            {
                collider.shape = 'cuboid'
                collider.parameters = [ physical.scale.x * 0.5, physical.scale.y * 0.5, physical.scale.z * 0.5 ]
            }

            colliders.push(collider)
        }

        // Add
        return this.add(
            {
                ..._physicalDescription,
                colliders: colliders
            },
            _visualModel
        )
    }

    update()
    {
        this.list.forEach((_entity) =>
        {
            if(_entity.visual)
            {
                if(!_entity.physical.body.isSleeping())
                {
                    _entity.visual.position.copy(_entity.physical.body.translation())
                    _entity.visual.quaternion.copy(_entity.physical.body.rotation())
                }
            }
        })
    }
}