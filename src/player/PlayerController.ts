import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { InputManager } from './InputManager'
import type { PlayerEntity } from './PlayerEntity'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS } from './PlayerEntity'
import type { CameraRig } from '@rendering/CameraRig'
import type { PhysicsWorld } from '@physics/PhysicsWorld'

// Mouse sensitivity (radians per pixel)
const MOUSE_SENSITIVITY = 0.0022
// Max pitch angle to prevent gimbal lock / neck-breaking
const MAX_PITCH = Math.PI / 2 - 0.05

const MOVE_SPEED    = 8    // m/s target horizontal speed
const JUMP_IMPULSE  = 7    // upward impulse on jump
const GROUND_DIST   = 0.15 // max distance from ground to be considered grounded
// Offset below capsule center to start the ground ray
const RAY_ORIGIN_OFFSET = -(CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

export class PlayerController {
    private yaw   = 0
    private pitch = 0

    private _isGrounded = false

    // Cached allocations to avoid per-frame GC pressure
    private static readonly _Y_AXIS  = new THREE.Vector3(0, 1, 0)
    private readonly _moveDir         = new THREE.Vector3()
    private readonly _groundRay       = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

    constructor(
        private input: InputManager,
        private player: PlayerEntity,
        private cameraRig: CameraRig,
        private physics: PhysicsWorld,
    ) {}

    update(_dt: number): void {
        this.processLook()
        this.processMovement()
        this.player.syncToScene()
        this.cameraRig.syncToBody(this.player.position, this.yaw, this.pitch)
    }

    private processLook(): void {
        if (!this.input.isPointerLocked) return

        const { dx, dy } = this.input.consumeMouseDelta()
        this.yaw   -= dx * MOUSE_SENSITIVITY
        this.pitch -= dy * MOUSE_SENSITIVITY
        this.pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch))
    }

    private processMovement(): void {
        const body = this.player.body
        const vel  = body.linvel()

        // Ground check via downward ray from capsule base
        const pos = body.translation()
        this._groundRay.origin.x = pos.x
        this._groundRay.origin.y = pos.y + RAY_ORIGIN_OFFSET
        this._groundRay.origin.z = pos.z
        const hit        = this.physics.world.castRay(this._groundRay, GROUND_DIST + 0.1, true)
        this._isGrounded = hit !== null

        // Build movement vector from WASD in camera-yaw space
        const forward = this.input.isDown('KeyW') ? 1 : this.input.isDown('KeyS') ? -1 : 0
        const strafe  = this.input.isDown('KeyD') ? 1 : this.input.isDown('KeyA') ? -1 : 0

        this._moveDir.set(strafe, 0, -forward)
        if (this._moveDir.lengthSq() > 0) {
            this._moveDir.normalize()
            // Rotate move direction by current yaw
            this._moveDir.applyAxisAngle(PlayerController._Y_AXIS, this.yaw)
        }

        // Set horizontal velocity directly for snappy first-person feel
        body.setLinvel(
            { x: this._moveDir.x * MOVE_SPEED, y: vel.y, z: this._moveDir.z * MOVE_SPEED },
            true
        )

        // Jump
        if (this.input.isDown('Space') && this._isGrounded) {
            body.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true)
        }
    }

    get isGrounded(): boolean {
        return this._isGrounded
    }
}
