import * as THREE from 'three'
import type { InputManager } from './InputManager'
import type { PlayerEntity } from './PlayerEntity'
import type { PlayerState } from './PlayerState'
import type { CameraRig } from '@rendering/CameraRig'
import { WORLD_GRAVITY } from '@physics/PhysicsWorld'

const MOUSE_SENSITIVITY = 0.0022
const MAX_PITCH         = Math.PI / 2 - 0.05

const MOVE_SPEED = 8            // m/s horizontal speed
const JUMP_SPEED = 10           // initial upward velocity on jump (m/s)
const GRAVITY    = WORLD_GRAVITY // kinematic body must apply gravity manually

// Respawn immediately if the player falls below this Y (no collider below → endless fall)
const VOID_Y = -30

// Fall damage kicks in above this downward speed (m/s); scales linearly beyond it
const FALL_DAMAGE_THRESHOLD = 13
const FALL_DAMAGE_SCALE     = 5

// Minimum difference between requested and resolved Y displacement to conclude
// a surface is holding us up (guards against floating-point noise near zero)
const TERRAIN_SUPPORT_EPSILON = 0.005

export class PlayerController {
    private yaw   = 0
    private pitch = 0

    private _isGrounded = false
    private _yVel       = 0  // vertical velocity: positive = up, negative = down

    private static readonly _Y_AXIS = new THREE.Vector3(0, 1, 0)
    private readonly _moveDir        = new THREE.Vector3()

    constructor(
        private input:       InputManager,
        private player:      PlayerEntity,
        private cameraRig:   CameraRig,
        private playerState: PlayerState,
        private onDeath:     () => void,
    ) {}

    update(dt: number): void {
        // Kill floor — if somehow below the world, respawn immediately
        if (this.player.body.translation().y < VOID_Y) {
            this.respawn()
            return
        }

        this.processLook()
        this.processMovement(dt)
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

    private processMovement(dt: number): void {
        // Capture vertical speed before this frame's gravity so fall damage sees impact speed
        const prevYVel = this._yVel

        // Accumulate gravity — zeroed on landing below
        this._yVel -= GRAVITY * dt

        // Jump
        if (this.input.isJustPressed('Space') && this._isGrounded) {
            this._yVel = JUMP_SPEED
        }

        // Horizontal direction from WASD in camera-yaw space
        const forward = this.input.isDown('KeyW') ? 1 : this.input.isDown('KeyS') ? -1 : 0
        const strafe  = this.input.isDown('KeyD') ? 1 : this.input.isDown('KeyA') ? -1 : 0

        this._moveDir.set(strafe, 0, -forward)
        if (this._moveDir.lengthSq() > 0) {
            this._moveDir.normalize()
            this._moveDir.applyAxisAngle(PlayerController._Y_AXIS, this.yaw)
        }

        // Desired displacement for this frame
        const displacement = {
            x: this._moveDir.x * MOVE_SPEED * dt,
            y: this._yVel * dt,
            z: this._moveDir.z * MOVE_SPEED * dt,
        }

        // KCC resolves the displacement against terrain: slides on slopes, climbs steps
        this.player.characterController.computeColliderMovement(this.player.collider, displacement)
        const move = this.player.characterController.computedMovement()

        const pos = this.player.body.translation()
        this.player.body.setNextKinematicTranslation({
            x: pos.x + move.x,
            y: pos.y + move.y,
            z: pos.z + move.z,
        })

        const wasGrounded = this._isGrounded
        this._isGrounded  = this.player.characterController.computedGrounded()

        // computedGrounded() is false on slopes steeper than maxSlopeClimbAngle.
        // Independently detect any terrain support: if we tried to fall but the KCC
        // resolved less downward movement, the surface is holding us up.
        const terrainSupport = this._yVel < 0 && move.y > displacement.y + TERRAIN_SUPPORT_EPSILON

        if (this._isGrounded || terrainSupport) {
            // Apply fall damage on the landing frame (only on true ground contact)
            if (this._isGrounded && !wasGrounded && prevYVel < -FALL_DAMAGE_THRESHOLD) {
                const damage = Math.round((-prevYVel - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_SCALE)
                this.playerState.takeDamage(damage)
                if (this.playerState.isDead()) {
                    this.respawn()
                    return
                }
            }
            // Stop accumulating gravity while any surface is supporting us
            if (this._yVel < 0) this._yVel = 0
        }
    }

    private respawn(): void {
        const safe = this.playerState.lastSafePosition
        // Teleport 2 units above last safe spot so the player doesn't clip into terrain
        this.player.body.setTranslation({ x: safe.x, y: safe.y + 2, z: safe.z }, true)
        this._yVel       = 0
        this._isGrounded = false
        this.playerState.restore()
        this.onDeath()
    }

    get isGrounded(): boolean {
        return this._isGrounded
    }
}
