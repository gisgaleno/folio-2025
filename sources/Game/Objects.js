import { Game } from './Game.js'

export class Objects
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

    add(_visualDescription = null, _physicalDescription = null)
    {
        const object = {
            visual: null,
            physical: null,
            needsUpdate: false
        }

        /**
         * Visual
         */
        if(_visualDescription && _visualDescription.model)
        {
            // Default parameters
            const visualDescription = {
                updateMaterials: true,
                castShadow: true,
                receiveShadow: true,
                parent: this.game.scene,
                ..._visualDescription
            }
            
            // Visual
            const visual = {}
            visual.object3D = _visualDescription.model
            visual.parent = visualDescription.parent

            // Update materials
            if(visualDescription.updateMaterials)
                this.game.materials.updateObject(visualDescription.model)

            // Update shadows
            if(visualDescription.castShadow || visualDescription.receiveShadow)
            {
                visualDescription.model.traverse(_child =>
                {
                    if(_child.isMesh)
                    {
                        if(visualDescription.castShadow)
                            _child.castShadow = true

                        if(visualDescription.receiveShadow)
                            _child.receiveShadow = true
                    }
                })
            }

            // Add to scene
            if(visualDescription.parent !== null)
                visualDescription.parent.add(visual.object3D)

            // Save
            object.visual = visual
        }

        /**
         * Physical
         */
        if(_physicalDescription)
        {
            object.physical = this.game.physics.getPhysical(_physicalDescription)
        }

        /**
         * Save physical in visual and vis versa
         */
        if(object.physical && object.visual)
        {
            object.visual.object3D.userData.object = object
            object.physical.body.userData = { object: object }
        }

        /**
         * Save
         */
        this.key++
        this.list.set(this.key, object)

        // If sleeping, not enabled or fixed apply transform directly
        if(object.visual && object.physical)
        {
            if(_physicalDescription.sleeping || !_physicalDescription.enabled || object.physical.type === 'fixed')
            {
                object.visual.object3D.position.copy(object.physical.body.translation())
                object.visual.object3D.quaternion.copy(object.physical.body.rotation())
            }
        }

        return object
    }

    getFromModel(_model, _visualDescription = {}, _physicalDescription = {})
    {
        // Extract physical from direct children and remove from scene
        const physical = _model.children.find(_child => _child.name.startsWith('physical'))

        // Create collider from physical children names and scales
        const colliders = []
        if(physical)
        {
            physical.removeFromParent()
            
            if(typeof _physicalDescription.type === 'undefined')
            {
                _physicalDescription.type = 'fixed'

                if(physical.name.match(/dynamic/i))
                    _physicalDescription.type = 'dynamic'
                else if(physical.name.match(/kinematicPositionBased/i))
                    _physicalDescription.type = 'kinematicPositionBased'
            }

            for(const _physical of physical.children)
            {
                const collider = {
                    position: _physical.position,
                    quaternion: _physical.quaternion,
                }
                if(_physical.name.match(/^trimesh/i))
                {
                    collider.shape = 'trimesh'
                    collider.parameters = [ _physical.geometry.attributes.position.array, _physical.geometry.index.array ]
                }
                else if(_physical.name.match(/^hull/i))
                {
                    collider.shape = 'hull'
                    collider.parameters = [ _physical.geometry.attributes.position.array, _physical.geometry.index.array ]
                }
                else if(_physical.name.match(/^cub/i))
                {
                    collider.shape = 'cuboid'
                    collider.parameters = [ _physical.scale.x * 0.5, _physical.scale.y * 0.5, _physical.scale.z * 0.5 ]
                }
                else if(_physical.name.match(/^cylinder/i))
                {
                    collider.shape = 'cylinder'
                    collider.parameters = [ _physical.scale.y * 0.5, _physical.scale.x * 0.5 ]
                }
                else if(_physical.name.match(/^ball/i) || _physical.name.match(/^sphere/i))
                {
                    collider.shape = 'ball'
                    collider.parameters = [ _physical.scale.y * 0.5 ]
                }

                colliders.push(collider)
            }
        }
        
        // Add
        return [
            { ..._visualDescription, model: _model },
            physical ? { ..._physicalDescription, colliders: colliders } : null
        ]
    }

    addFromModel(_model, _visualDescription = {}, _physicalDescription = {})
    {
        // Add
        return this.add(...this.getFromModel(_model, _visualDescription, _physicalDescription))
    }

    reset()
    {
        this.list.forEach((object) =>
        {
            if(object.physical)
            {
                if(object.physical.type === 'dynamic' || object.physical.type === 'kinematicPositionBased')
                {
                    object.physical.body.setTranslation(object.physical.initialState.position)
                    object.physical.body.setRotation(object.physical.initialState.rotation)
                    object.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
                    object.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
                    object.physical.body.setEnabled(true)
                    
                    if(object.physical.initialState.sleeping)
                    {
                        requestAnimationFrame(() =>
                        {
                            object.physical.body.sleep()
                        })
                    }
                    
                    if(object.visual)
                    {
                        if(object.visual.parent)
                            object.visual.parent.add(object.visual.object3D)
                        object.visual.object3D.position.copy(object.physical.initialState.position)
                        object.visual.object3D.quaternion.copy(object.physical.initialState.rotation)
                    }
                }
            }
        })
    }

    disable(object)
    {
        // this.game.physics.world.removeRigidBody(object.physical.body)
        object.physical.body.setEnabled(false)
        object.visual.object3D.removeFromParent()
    }

    update()
    {
        this.list.forEach((_object) =>
        {
            if(
                _object.needsUpdate ||
                (
                    _object.visual &&
                    _object.physical &&
                    !_object.physical.body.isSleeping()
                )
            )
            {
                _object.visual.object3D.position.copy(_object.physical.body.translation())
                _object.visual.object3D.quaternion.copy(_object.physical.body.rotation())
            }
        })
    }
}