import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import * as THREE from 'three/webgpu'

export class ResourcesLoader
{
    constructor()
    {
        this.loaders = new Map()
        this.cache = new Map()
    }

    getLoader(_type)
    {
        if(this.loaders.has(_type))
            return this.loaders.get(_type)

        let loader = null
        
        if(_type === 'texture')
            loader = new THREE.TextureLoader()
        else if(_type === 'gltf')
        {
            const dracoLoader = new DRACOLoader()
            dracoLoader.setDecoderPath('./draco/')
            dracoLoader.preload()
            
            loader = new GLTFLoader()
            loader.setDRACOLoader(dracoLoader)
        }

        this.loaders.set(_type, loader)

        return loader
    }

    load(_files, _callback = null)
    {
        let toLoad = _files.length
        const loadedResources = {}

        // Progress
        const progress = () =>
        {
            toLoad--
            
            if(toLoad === 0)
                _callback(loadedResources)
        }

        // Save
        const save = (_file, _resource) =>
        {
            // Apply modifier
            if(typeof _file[3] !== 'undefined')
                _file[3](_resource)
                
            // Save in resources object
            loadedResources[_file[0]] = _resource

            // Save in cache
            this.cache.set(_file[1], _resource)
        }

        // Error
        const error = (_file) =>
        {
            console.log(`Resources > Couldn't load file ${_file[1]}`)
        }

        // Each file
        for(const _file of _files)
        {
            // In cache
            if(this.cache.has(_file[1]))
            {
                progress()
            }

            // Not in cache
            else
            {
                const loader = this.getLoader(_file[2])
                loader.load(
                    _file[1],
                    resource => {
                        save(_file, resource)
                        progress()
                    },
                    undefined,
                    // resource => { error(_file, resource) },
                )
            }
        }
    }
}