import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { sampleBlended } from '@world/TerrainSampler'
import type { MapParser } from '@world/MapParser'
import type { PlayerState } from '@player/PlayerState'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import { MAT_ENEMY_BODY, MAT_ENEMY_JOINT, makeSensorMat } from './EnemyMaterials'

// --- AI constants ---

const ENEMY_MAX_HP        = 60
const PATROL_SPEED        = 1.8   // units/sec
const CHASE_SPEED         = 4.5
const DETECT_RANGE        = 18    // horizontal distance to trigger chase
const LOSE_RANGE          = 28    // horizontal distance to give up chase
const ATTACK_RANGE        = 3.0   // melee strike distance
const ATTACK_RESUME_RANGE = 4.5   // re-enter chase once player moves back
const ATTACK_DAMAGE       = 12    // HP per melee hit
const ATTACK_COOLDOWN     = 1.4   // seconds between strikes
const ATTACK_ARM_DURATION = 0.3   // seconds for the arm-swing animation on melee hit
const PATROL_ARRIVE_DIST  = 0.4   // waypoint arrival threshold
const PATROL_WAIT_TIME    = 1.5   // idle pause at each waypoint
const DEATH_DURATION      = 1.2   // seconds for the death-fall animation
const LOS_INTERVAL        = 0.10  // max LoS check rate per enemy

// ---

enum EnemyState {
    PATROL = 'PATROL',
    CHASE  = 'CHASE',
    ATTACK = 'ATTACK',
    DEAD   = 'DEAD',
}

export class EnemyEntity {
    readonly root: THREE.Group
    isFullyDead = false

    private hp = ENEMY_MAX_HP
    private state: EnemyState = EnemyState.PATROL

    // Patrol
    private readonly wp0: THREE.Vector3
    private readonly wp1: THREE.Vector3
    private patrolWpTarget = 0
    private patrolWaitTimer = 0

    // Chase / LoS
    private losingLosTimer = 0
    private losTimer: number
    private hasLos = false

    // Attack
    private attackCooldown = 0
    private attackArmTimer = 0

    // Death animation
    private deathTimer = 0
    private readonly spawnGroundY: number

    // Walk animation
    private walkPhase = 0

    // Animated mesh refs
    private readonly leftLegGroup:  THREE.Object3D
    private readonly rightLegGroup: THREE.Object3D
    private readonly leftArm:  THREE.Mesh
    private readonly rightArm: THREE.Mesh
    private readonly sensorMat: THREE.MeshStandardMaterial

    // O(1) hit detection — all meshes belonging to this enemy
    private readonly ownedMeshes: Set<THREE.Object3D>

    private inScene = true

    constructor(
        wx: number, wy: number, wz: number,
        initialYaw: number,
        wp0x: number, wp0z: number,
        wp1x: number, wp1z: number,
        losTimerOffset: number,
        private readonly mapParser: MapParser,
        private readonly physics: PhysicsWorld,
        scene: THREE.Scene,
    ) {
        this.spawnGroundY = wy
        this.losTimer     = losTimerOffset
        this.ownedMeshes  = new Set()
        this.sensorMat    = makeSensorMat()

        this.root = new THREE.Group()
        const built = this.buildGeometry()
        this.leftLegGroup  = built.leftLegGroup
        this.rightLegGroup = built.rightLegGroup
        this.leftArm       = built.leftArm
        this.rightArm      = built.rightArm

        this.root.position.set(wx, wy, wz)
        this.root.rotation.y = initialYaw
        scene.add(this.root)

        this.wp0 = new THREE.Vector3(wp0x, wy, wp0z)
        this.wp1 = new THREE.Vector3(wp1x, wy, wp1z)
    }

    private buildGeometry(): {
        leftLegGroup:  THREE.Object3D
        rightLegGroup: THREE.Object3D
        leftArm:  THREE.Mesh
        rightArm: THREE.Mesh
    } {
        const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
            const m = new THREE.Mesh(geo, mat)
            m.castShadow = true
            this.ownedMeshes.add(m)
            return m
        }

        // Left leg group — pivot at hip joint (y=1.0)
        const leftLegGroup = new THREE.Object3D()
        leftLegGroup.position.set(-0.12, 1.0, 0)
        const leftUpperLeg = addMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6), MAT_ENEMY_BODY)
        leftUpperLeg.position.set(0, -0.275, 0)
        const leftLowerLeg = addMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.45, 6), MAT_ENEMY_BODY)
        leftLowerLeg.position.set(0, -0.775, 0)
        leftLegGroup.add(leftUpperLeg)
        leftLegGroup.add(leftLowerLeg)
        this.root.add(leftLegGroup)

        // Right leg group — pivot at hip joint (y=1.0)
        const rightLegGroup = new THREE.Object3D()
        rightLegGroup.position.set(0.12, 1.0, 0)
        const rightUpperLeg = addMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6), MAT_ENEMY_BODY)
        rightUpperLeg.position.set(0, -0.275, 0)
        const rightLowerLeg = addMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.45, 6), MAT_ENEMY_BODY)
        rightLowerLeg.position.set(0, -0.775, 0)
        rightLegGroup.add(rightUpperLeg)
        rightLegGroup.add(rightLowerLeg)
        this.root.add(rightLegGroup)

        // Pelvis connector
        const pelvis = addMesh(new THREE.BoxGeometry(0.30, 0.12, 0.12), MAT_ENEMY_JOINT)
        pelvis.position.set(0, 1.05, 0)
        this.root.add(pelvis)

        // Torso
        const torso = addMesh(new THREE.CylinderGeometry(0.10, 0.14, 0.60, 8), MAT_ENEMY_BODY)
        torso.position.set(0, 1.35, 0)
        this.root.add(torso)

        // Left arm — slight outward cant
        const leftArm = addMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 5), MAT_ENEMY_BODY)
        leftArm.position.set(-0.22, 1.30, 0)
        leftArm.rotation.z = 0.2
        this.root.add(leftArm)

        // Right arm
        const rightArm = addMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 5), MAT_ENEMY_BODY)
        rightArm.position.set(0.22, 1.30, 0)
        rightArm.rotation.z = -0.2
        this.root.add(rightArm)

        // Neck
        const neck = addMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 4), MAT_ENEMY_JOINT)
        neck.position.set(0, 1.71, 0)
        this.root.add(neck)

        // Head — low-detail icosahedron for angular look
        const head = addMesh(new THREE.IcosahedronGeometry(0.18, 1), MAT_ENEMY_BODY)
        head.position.set(0, 1.90, 0)
        this.root.add(head)

        // Eye sensors — cloned per-enemy material for hit flash
        const leftEye = addMesh(new THREE.SphereGeometry(0.04, 4, 3), this.sensorMat)
        leftEye.position.set(-0.07, 1.95, 0.14)
        this.root.add(leftEye)

        const rightEye = addMesh(new THREE.SphereGeometry(0.04, 4, 3), this.sensorMat)
        rightEye.position.set(0.07, 1.95, 0.14)
        this.root.add(rightEye)

        return { leftLegGroup, rightLegGroup, leftArm, rightArm }
    }

    /** True if `obj` is one of the meshes that make up this enemy — O(1) lookup. */
    ownsObject(obj: THREE.Object3D): boolean {
        return this.ownedMeshes.has(obj)
    }

    takeDamage(amount: number): void {
        if (this.state === EnemyState.DEAD) return
        this.hp = Math.max(0, this.hp - amount)
        this.sensorMat.emissiveIntensity = 5.0  // hit flash
        if (this.hp <= 0) this.state = EnemyState.DEAD
    }

    update(dt: number, playerPos: THREE.Vector3, playerState: PlayerState, scene: THREE.Scene): void {
        switch (this.state) {
            case EnemyState.PATROL: this.updatePatrol(dt, playerPos); break
            case EnemyState.CHASE:  this.updateChase(dt, playerPos); break
            case EnemyState.ATTACK: this.updateAttack(dt, playerPos, playerState); break
            case EnemyState.DEAD:   this.updateDead(dt, scene); break
        }
    }

    private updatePatrol(dt: number, playerPos: THREE.Vector3): void {
        const dist = this.hDist(playerPos)
        if (dist < DETECT_RANGE) {
            this.checkLos(dt, playerPos)
            if (this.hasLos) {
                this.state = EnemyState.CHASE
                this.losingLosTimer = 0
                return
            }
        }

        if (this.patrolWaitTimer > 0) {
            this.patrolWaitTimer -= dt
            this.fadeHitFlash(dt)
            return
        }

        const wp = this.patrolWpTarget === 0 ? this.wp0 : this.wp1
        const dx = wp.x - this.root.position.x
        const dz = wp.z - this.root.position.z
        const d  = Math.sqrt(dx * dx + dz * dz)

        if (d < PATROL_ARRIVE_DIST) {
            this.patrolWpTarget  = this.patrolWpTarget === 0 ? 1 : 0
            this.patrolWaitTimer = PATROL_WAIT_TIME
            return
        }

        const step = PATROL_SPEED * dt
        this.moveXZ((dx / d) * step, (dz / d) * step)
        this.faceDir(dx / d, dz / d)
        this.walkAnim(dt, PATROL_SPEED)
    }

    private updateChase(dt: number, playerPos: THREE.Vector3): void {
        const dist = this.hDist(playerPos)

        if (dist < ATTACK_RANGE) {
            this.state = EnemyState.ATTACK
            this.attackCooldown = 0
            return
        }

        this.checkLos(dt, playerPos)

        if (!this.hasLos) {
            this.losingLosTimer += dt
            if (this.losingLosTimer >= 3.0) {
                this.state = EnemyState.PATROL
                this.losingLosTimer = 0
                return
            }
        } else {
            this.losingLosTimer = 0
        }

        if (dist > LOSE_RANGE) {
            this.state = EnemyState.PATROL
            return
        }

        const dx = playerPos.x - this.root.position.x
        const dz = playerPos.z - this.root.position.z
        const step = CHASE_SPEED * dt
        this.moveXZ((dx / dist) * step, (dz / dist) * step)
        this.faceDir(dx / dist, dz / dist)
        this.walkAnim(dt, CHASE_SPEED)
    }

    private updateAttack(dt: number, playerPos: THREE.Vector3, playerState: PlayerState): void {
        const dist = this.hDist(playerPos)

        if (dist > ATTACK_RESUME_RANGE) {
            this.state = EnemyState.CHASE
            this.rightArm.rotation.x = 0
            return
        }

        // Always face player
        const dx = playerPos.x - this.root.position.x
        const dz = playerPos.z - this.root.position.z
        const d  = Math.sqrt(dx * dx + dz * dz)
        if (d > 0.01) this.faceDir(dx / d, dz / d)

        this.attackCooldown = Math.max(0, this.attackCooldown - dt)

        if (this.attackCooldown <= 0) {
            playerState.takeDamage(ATTACK_DAMAGE)
            this.attackCooldown = ATTACK_COOLDOWN
            this.attackArmTimer = ATTACK_ARM_DURATION
        }

        // Strike arm animation
        if (this.attackArmTimer > 0) {
            this.attackArmTimer = Math.max(0, this.attackArmTimer - dt)
            const t = this.attackArmTimer / ATTACK_ARM_DURATION
            this.rightArm.rotation.x = -Math.sin(t * Math.PI) * 0.9
        } else {
            this.rightArm.rotation.x = 0
        }

        this.fadeHitFlash(dt)
    }

    private updateDead(dt: number, scene: THREE.Scene): void {
        this.deathTimer += dt
        const t = Math.min(this.deathTimer / DEATH_DURATION, 1.0)

        this.root.rotation.x    = t * (Math.PI / 2)
        this.root.position.y    = this.spawnGroundY - t * 0.3
        this.sensorMat.emissiveIntensity = (1 - t) * 1.5

        if (this.deathTimer >= DEATH_DURATION) {
            this.removeFromScene(scene)
            this.isFullyDead = true
        }
    }

    private moveXZ(dx: number, dz: number): void {
        const nx = this.root.position.x + dx
        const nz = this.root.position.z + dz
        this.root.position.set(nx, sampleBlended(nx, nz, this.mapParser), nz)
    }

    private faceDir(nx: number, nz: number): void {
        this.root.rotation.y = Math.atan2(nx, nz)
    }

    private walkAnim(dt: number, speed: number): void {
        this.walkPhase += dt * speed * 2.5
        this.leftLegGroup.rotation.x  =  Math.sin(this.walkPhase) * 0.5
        this.rightLegGroup.rotation.x = -Math.sin(this.walkPhase) * 0.5
        // Counter-swing arms for a natural gait
        this.leftArm.rotation.x  = -Math.sin(this.walkPhase) * 0.25
        this.rightArm.rotation.x  =  Math.sin(this.walkPhase) * 0.25
        this.fadeHitFlash(dt)
    }

    private fadeHitFlash(dt: number): void {
        if (this.sensorMat.emissiveIntensity > 1.5) {
            this.sensorMat.emissiveIntensity = Math.max(1.5, this.sensorMat.emissiveIntensity - dt * 20)
        }
    }

    private hDist(playerPos: THREE.Vector3): number {
        const dx = playerPos.x - this.root.position.x
        const dz = playerPos.z - this.root.position.z
        return Math.sqrt(dx * dx + dz * dz)
    }

    // Rapier raycast for line-of-sight — runs at most every LOS_INTERVAL seconds
    private checkLos(dt: number, playerPos: THREE.Vector3): void {
        this.losTimer -= dt
        if (this.losTimer > 0) return
        this.losTimer = LOS_INTERVAL

        const headY  = this.root.position.y + 1.9
        const targetY = playerPos.y + 1.6
        const dx = playerPos.x - this.root.position.x
        const dy = targetY - headY
        const dz = playerPos.z - this.root.position.z
        const dist3 = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist3 < 0.001) {
            this.hasLos = true
            return
        }

        const ray = new RAPIER.Ray(
            { x: this.root.position.x, y: headY, z: this.root.position.z },
            { x: dx / dist3, y: dy / dist3, z: dz / dist3 },
        )

        // LoS clear if no terrain collider is hit before reaching the player
        const hit = this.physics.world.castRay(ray, dist3, true)
        this.hasLos = hit === null || hit.timeOfImpact >= dist3 * 0.9
    }

    removeFromScene(scene: THREE.Scene): void {
        if (!this.inScene) return
        this.inScene = false
        scene.remove(this.root)
        this.root.traverse((child) => {
            if (child instanceof THREE.Mesh) child.geometry.dispose()
        })
        this.sensorMat.dispose()
    }
}
