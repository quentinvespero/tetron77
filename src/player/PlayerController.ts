import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { InputManager } from './InputManager'
import type { PlayerEntity } from './PlayerEntity'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS } from './PlayerEntity'
import type { PlayerState } from './PlayerState'
import type { CameraRig } from '@rendering/CameraRig'
import type { PhysicsWorld } from '@physics/PhysicsWorld'

const MOUSE_SENSITIVITY = 0.0022
const MAX_PITCH         = Math.PI / 2 - 0.05

const MOVE_SPEED   = 8   // m/s target horizontal speed
const JUMP_IMPULSE = 6   // upward impulse — gives ~2.8m height with default capsule mass
const GROUND_DIST  = 0.15

// Fall damage kicks in above this downward speed (m/s); damage scales linearly beyond it
const FALL_DAMAGE_THRESHOLD = 13
const FALL_DAMAGE_SCALE     = 5

// Offset below capsule centre to start the ground ray
const RAY_ORIGIN_OFFSET = -(CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

export class PlayerController {
    private yaw   = 0
    private pitch = 0

    private _isGrounded  = false
    private _wasGrounded = false
    private _prevYVel    = 0

    private static readonly _Y_AXIS = new THREE.Vector3(0, 1, 0)
    private readonly _moveDir        = new THREE.Vector3()
    private readonly _groundRay      = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

    constructor(
        private input:       InputManager,
        private player:      PlayerEntity,
        private cameraRig:   CameraRig,
        private physics:     PhysicsWorld,
        private playerState: PlayerState,
        private onDeath:     () => void,
    ) {}

    update(dt: number): void {
        this.processLook()
        this.processMovement()
        this.player.syncToScene()
        this.playerState.updateSafePosition(this.player.position, this._isGrounded, dt)
        this.cameraRig.syncToBody(this.player.position, this.yaw, this.pitch)
        this.input.flushJustPressed()
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

        // Detect the moment of landing and apply fall damage
        if (this._isGrounded && !this._wasGrounded && this._prevYVel < -FALL_DAMAGE_THRESHOLD) {
            const speed  = -this._prevYVel
            const damage = Math.round((speed - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_SCALE)
            this.playerState.takeDamage(damage)
            if (this.playerState.isDead()) {
                this.respawn()
            }
        }

        // Store state for next frame's landing detection
        this._wasGrounded = this._isGrounded
        this._prevYVel    = vel.y

        // Build movement vector from WASD in camera-yaw space
        const forward = this.input.isDown('KeyW') ? 1 : this.input.isDown('KeyS') ? -1 : 0
        const strafe  = this.input.isDown('KeyD') ? 1 : this.input.isDown('KeyA') ? -1 : 0

        this._moveDir.set(strafe, 0, -forward)
        if (this._moveDir.lengthSq() > 0) {
            this._moveDir.normalize()
            this._moveDir.applyAxisAngle(PlayerController._Y_AXIS, this.yaw)
        }

        body.setLinvel(
            { x: this._moveDir.x * MOVE_SPEED, y: vel.y, z: this._moveDir.z * MOVE_SPEED },
            true
        )

        if (this.input.isJustPressed('Space') && this._isGrounded) {
            body.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true)
        }
    }

    private respawn(): void {
        const safe = this.playerState.lastSafePosition
        // Teleport 2 units above last safe spot so the player doesn't clip into terrain
        this.player.body.setTranslation({ x: safe.x, y: safe.y + 2, z: safe.z }, true)
        this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.playerState.restore()
        this.onDeath()
        // Reset landing-detection state so the short drop after teleport doesn't re-trigger
        this._wasGrounded = false
        this._prevYVel    = 0
    }

    get isGrounded(): boolean {
        return this._isGrounded
    }
}
