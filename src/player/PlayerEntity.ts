import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import type { MapParser } from '@world/MapParser'
import { sampleBlended } from '@world/TerrainSampler'

// Capsule dimensions — half-height excludes the hemisphere caps
export const CAPSULE_HALF_HEIGHT = 0.5
export const CAPSULE_RADIUS      = 0.35

// Spawn position — 1 pixel in map.png = 32 world units
// e.g. to spawn at pixel (col, row): SPAWN_X = col*32, SPAWN_Z = row*32
const SPAWN_X = 5 * 32  // pixel (5, 5) on map.png — plains zone
const SPAWN_Z = 5 * 32

// Place the capsule bottom just above the collider surface — no more, no less
const SPAWN_CLEARANCE = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + 0.05

// KCC tuning
const KCC_SKIN_WIDTH      = 0.01  // gap kept between the collider and any surface
const KCC_MAX_SLOPE_CLIMB = 45    // degrees — steeper slopes block movement
const KCC_MIN_SLOPE_SLIDE = 30    // degrees — gentler slopes allow walking
const KCC_STEP_HEIGHT     = 0.3   // m — max step the player can auto-climb
const KCC_STEP_MIN_WIDTH  = 0.2   // m — min horizontal clearance required above a step
const KCC_SNAP_DISTANCE   = 0.3   // m — snap-to-ground range to stay glued on descents

export class PlayerEntity {
    readonly body:                RAPIER.RigidBody
    readonly collider:            RAPIER.Collider
    readonly characterController: RAPIER.KinematicCharacterController
    // Anchor object used to read the body's world position each frame
    readonly anchor = new THREE.Object3D()
    // Cached so startPosition doesn't recompute
    private readonly spawnY: number

    constructor(private readonly physics: PhysicsWorld, mapParser: MapParser) {
        // Use sampleBlended so spawn height matches the actual heightfield collider.
        // Fall back to 0 if the map hasn't resolved the zone (out-of-bounds coords).
        const terrainY = sampleBlended(SPAWN_X, SPAWN_Z, mapParser)
        this.spawnY = (isFinite(terrainY) ? terrainY : 0) + SPAWN_CLEARANCE

        // Kinematic body — KCC controls movement, Rapier gravity is ignored
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(SPAWN_X, this.spawnY, SPAWN_Z)

        this.body = physics.createRigidBody(bodyDesc)

        // No friction/restitution needed — KCC handles terrain interaction
        const colliderDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
        this.collider = physics.createCollider(colliderDesc, this.body)

        // KinematicCharacterController — handles slopes, steps, and terrain seams
        this.characterController = physics.world.createCharacterController(KCC_SKIN_WIDTH)
        this.characterController.setMaxSlopeClimbAngle(KCC_MAX_SLOPE_CLIMB * Math.PI / 180)
        this.characterController.setMinSlopeSlideAngle(KCC_MIN_SLOPE_SLIDE * Math.PI / 180)
        this.characterController.enableAutostep(KCC_STEP_HEIGHT, KCC_STEP_MIN_WIDTH, true)
        this.characterController.enableSnapToGround(KCC_SNAP_DISTANCE)
    }

    /** Reads Rapier body position and writes it to the Three.js anchor. */
    syncToScene(): void {
        const pos = this.body.translation()
        this.anchor.position.set(pos.x, pos.y, pos.z)
    }

    get position(): THREE.Vector3 {
        return this.anchor.position
    }

    get startPosition(): THREE.Vector3 {
        return new THREE.Vector3(SPAWN_X, this.spawnY, SPAWN_Z)
    }

}
