import * as THREE from 'three'
import { Game } from '../Game.js'
import { screenUV, mul, cos, sin, sign, atan2, varying, float, uv, texture, Fn, vec2, vec3, vec4, positionGeometry } from 'three'

export class Track
{
    constructor()
    {
        this.game = new Game()

        this.subdivisions = 128

        this.timeThrottle = 1 / 30
        this.lastTime = 0

        this.positionThrottle = 0.1
        this.lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity)
        
        this.setDataTexture()
        this.setTrail()
        // this.setDebugPlane()
    }

    setDataTexture()
    {
        this.dataTexture = new THREE.DataTexture(
            new Float32Array(this.subdivisions * 4),
            this.subdivisions,
            1,
            THREE.RGBAFormat,
            THREE.FloatType
        )
    }

    setTrail()
    {
        this.trail = {}
        this.trail.geometry = new THREE.PlaneGeometry(1, 1, this.subdivisions, 1)
        this.trail.geometry.translate(0.5, 0, 0)
        // this.trail.geometry.rotateX(Math.PI * 0.5)
        
        this.trail.material = new THREE.MeshBasicNodeMaterial({ wireframe: false, depthTest: false, transparent: true })

        const trackData = varying(vec4())
        
        this.trail.material.positionNode = Fn(() =>
        {
            const fragmentSize = float(1).div(this.subdivisions)

            const ratio = uv().x.sub(fragmentSize.mul(0.5))

            const trackUV = vec2(
                ratio,
                0.5
            )
            const trackUVPrev = vec2(
                ratio.sub(fragmentSize),
                0.5
            )
            trackData.assign(texture(this.dataTexture, trackUV))
            const trackDataPrev = texture(this.dataTexture, trackUVPrev)

            const angle = atan2(
                trackData.z.sub(trackDataPrev.z),
                trackData.x.sub(trackDataPrev.x),
            )

            const sideSign = sign(positionGeometry.y).mul(-1)
            const testPosition = vec2(
                cos(angle.add(sideSign.mul(Math.PI * 0.5))),
                sin(angle.add(sideSign.mul(Math.PI * 0.5)))
            ).mul(0.35)
            
            const newPosition = vec3(
                trackData.x.add(testPosition.x),
                trackData.y,
                trackData.z.add(testPosition.y)
            )

            return newPosition
        })()
        
        this.trail.material.outputNode = Fn(() =>
        {
            const endAlpha = uv().x.smoothstep(0.5, 1).oneMinus()
            const contactAlpha = trackData.a
            const trackEdgeAlpha = mul(
                uv().y.remapClamp(0, 0.2, 0, 1),
                uv().y.remapClamp(0.8, 1, 1, 0)
            )
            const renderEdgeAlpha = mul(
                screenUV.x.remapClamp(0, 0.2, 0, 1),
                screenUV.x.remapClamp(0.8, 1, 1, 0),
                screenUV.y.remapClamp(0, 0.2, 0, 1),
                screenUV.y.remapClamp(0.8, 1, 1, 0),
            )

            const alpha = endAlpha.mul(contactAlpha).mul(trackEdgeAlpha).mul(renderEdgeAlpha)
            return vec4(uv(), 1, alpha)
        })()
        
        this.trail.mesh = new THREE.Mesh(this.trail.geometry, this.trail.material)
        this.trail.mesh.frustumCulled = false
        this.game.scene.add(this.trail.mesh)
    }

    setDebugPlane()
    {
        this.debugPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 1),
            new THREE.MeshBasicMaterial({ map: this.dataTexture })
        )
        this.debugPlane.position.y = 2
        this.game.scene.add(this.debugPlane)
    }

    update(_position, _touching)
    {
        const data = this.dataTexture.source.data.data

        // Throttle by time
        const lastTimeDelta = this.game.time.elapsed - this.lastTime
        if(lastTimeDelta > this.timeThrottle)
        {
            // Throttle by distance
            const positionDelta = this.lastPosition.clone().sub(_position)
            const distance = positionDelta.length()
            
            if(distance > this.positionThrottle)
            {
                // Move data one "pixel"
                for(let i = this.subdivisions - 1; i >= 0; i--)
                {
                    const i4 = i * 4
                    data[i4    ] = data[i4 - 4]
                    data[i4 + 1] = data[i4 - 3]
                    data[i4 + 2] = data[i4 - 2]
                    data[i4 + 3] = data[i4 - 1]
                }

                // Save time and position
                this.lastTime = this.game.time.elapsed
                this.lastPosition.copy(_position)
            }
        }

        // Draw new position
        data[0] = _position.x
        data[1] = _position.y
        data[2] = _position.z
        data[3] = _touching ? 1 : 0

        this.dataTexture.needsUpdate = true
    }
}