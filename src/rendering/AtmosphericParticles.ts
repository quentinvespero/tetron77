import * as THREE from 'three'
import type { Updatable } from '@core/GameLoop'

// Switch ACTIVE_PRESET to change the global atmospheric effect
const ASHES = {
    count:   8000,
    speed:   1.8,
    drift:   5.0,
    size:    1.4,
    opacity: 0.18,
    streak:  0.0, // round flake shape
    color:   new THREE.Color(0x888888),
}

const RAIN = {
    count:   10000,
    speed:   38.0,
    drift:   1.5,
    size:    5.5,
    opacity: 0.9,
    streak:  1.0, // elongated streak shape
    color:   new THREE.Color(0x000000),
}

const ACTIVE_PRESET = RAIN

// Particle volume (world units) centered on the camera
const VOL_X = 80
const VOL_Y = 40
const VOL_Z = 80

// Perspective point-size scale: tuned so particles feel correctly sized at typical view distances
const POINT_SCALE = 200

const VERTEX_SHADER = /* glsl */`
    uniform float uTime;
    uniform float uSpeed;
    uniform float uDrift;
    uniform float uSize;
    uniform vec3  uCamPos;

    attribute vec3 aOffset;

    void main() {
        // Horizontal position: distribute across the volume centered on camera
        float x = uCamPos.x + aOffset.x * ${VOL_X.toFixed(1)} - ${(VOL_X / 2).toFixed(1)};
        float z = uCamPos.z + aOffset.z * ${VOL_Z.toFixed(1)} - ${(VOL_Z / 2).toFixed(1)};

        // Vertical: each particle falls from its slot, wraps at bottom of volume
        float fallY = mod(aOffset.y * ${VOL_Y.toFixed(1)} - uTime * uSpeed, ${VOL_Y.toFixed(1)});
        float y = uCamPos.y + fallY - ${(VOL_Y / 2).toFixed(1)};

        // Slow organic sway: ash drifting in dead wind
        x += uDrift * sin(uTime * 0.3 + aOffset.z * 6.2832);
        z += uDrift * 0.4 * cos(uTime * 0.2 + aOffset.x * 6.2832);

        vec4 mvPos = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(uSize * ${POINT_SCALE.toFixed(1)} / -mvPos.z, 0.5, 64.0);
    }
`

const FRAGMENT_SHADER = /* glsl */`
    uniform float uOpacity;
    uniform float uStreak;
    uniform vec3  uColor;

    void main() {
        // Round shape (ashes): soft circular fade
        float dr = length(gl_PointCoord - 0.5) * 2.0;

        // Streak shape (rain): narrow horizontally, full height
        float dx = (gl_PointCoord.x - 0.5) * 10.0;
        float dy = (gl_PointCoord.y - 0.5);
        float ds = length(vec2(dx, dy)) * 2.0;

        float d = mix(dr, ds, uStreak);
        if (d > 1.0) discard;
        float alpha = uOpacity * (1.0 - d * d);
        gl_FragColor = vec4(uColor, alpha);
    }
`

export class AtmosphericParticles implements Updatable {
    private material: THREE.ShaderMaterial
    private geometry: THREE.BufferGeometry
    private points: THREE.Points
    private time = 0

    constructor(scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera) {
        const { count, speed, drift, size, opacity, streak, color } = ACTIVE_PRESET

        // Random offsets baked into a buffer attribute — never updated on CPU
        const offsets = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            offsets[i * 3]     = Math.random()
            offsets[i * 3 + 1] = Math.random()
            offsets[i * 3 + 2] = Math.random()
        }

        this.geometry = new THREE.BufferGeometry()
        // Dummy zeroed positions — the vertex shader computes actual world positions
        this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
        this.geometry.setAttribute('aOffset',  new THREE.BufferAttribute(offsets, 3))

        this.material = new THREE.ShaderMaterial({
            vertexShader:   VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms: {
                uTime:    { value: 0 },
                uSpeed:   { value: speed },
                uDrift:   { value: drift },
                uSize:    { value: size },
                uOpacity: { value: opacity },
                uStreak:  { value: streak },
                uColor:   { value: color },
                uCamPos:  { value: new THREE.Vector3() },
            },
            transparent: true,
            depthWrite:  false,
        })

        this.points = new THREE.Points(this.geometry, this.material)
        // Disable frustum culling — bounding box can't track camera-relative particles
        this.points.frustumCulled = false
        scene.add(this.points)
    }

    update(dt: number): void {
        this.time += dt
        this.material.uniforms['uTime']!.value   = this.time
        this.material.uniforms['uCamPos']!.value.copy(this.camera.position)
    }

    dispose(): void {
        this.points.parent?.remove(this.points)
        this.geometry.dispose()
        this.material.dispose()
    }
}
