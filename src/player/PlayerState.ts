import * as THREE from 'three'

const MAX_HP = 100

// Interval (seconds) between last-safe-position snapshots
const SAFE_INTERVAL = 1

export class PlayerState {
    readonly username: string
    private _hp = MAX_HP
    readonly maxHp = MAX_HP

    get hp(): number { return this._hp }
    lastSafePosition = new THREE.Vector3()

    private safeTimer = 0

    constructor(username: string, spawnPosition: THREE.Vector3) {
        this.username = username
        this.lastSafePosition.copy(spawnPosition)
    }

    takeDamage(amount: number): void {
        this._hp = Math.max(0, this._hp - amount)
    }

    restore(): void {
        this._hp = this.maxHp
        this.safeTimer = 0
    }

    isDead(): boolean {
        return this._hp <= 0
    }

    /** Snapshots the player's position as the last safe location.
     *  Only updates when grounded and alive, at most once per SAFE_INTERVAL seconds. */
    updateSafePosition(position: THREE.Vector3, isGrounded: boolean, dt: number): void {
        if (!isGrounded || this.isDead()) return
        this.safeTimer += dt
        if (this.safeTimer >= SAFE_INTERVAL) {
            this.safeTimer = 0
            this.lastSafePosition.copy(position)
        }
    }
}
