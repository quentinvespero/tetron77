import * as THREE from 'three'
import type { SceneManager } from './SceneManager'

// Eye height above the bottom of the physics capsule
const EYE_HEIGHT = 1.6

export class CameraRig {
    readonly camera: THREE.PerspectiveCamera

    constructor(sceneManager: SceneManager) {
        this.camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            0.05,
            500
        )

        this.camera.rotation.order = 'YXZ'

        sceneManager.onResize(() => {
            this.camera.aspect = window.innerWidth / window.innerHeight
            this.camera.updateProjectionMatrix()
        })
    }

    setFov(fov: number): void {
        this.camera.fov = fov
        this.camera.updateProjectionMatrix()
    }

    /**
     * Called each frame by PlayerController after physics step.
     * @param position  World-space position of the physics body base
     * @param yaw       Horizontal rotation in radians (Y-axis)
     * @param pitch     Vertical rotation in radians (X-axis), clamped externally
     */
    syncToBody(position: THREE.Vector3, yaw: number, pitch: number): void {
        this.camera.position.set(
            position.x,
            position.y + EYE_HEIGHT,
            position.z
        )

        // Apply yaw then pitch via Euler (order set once in constructor)
        this.camera.rotation.y = yaw
        this.camera.rotation.x = pitch
    }
}
