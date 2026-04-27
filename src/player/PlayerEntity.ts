import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { PhysicsWorld } from '@physics/PhysicsWorld'

// Capsule dimensions — half-height excludes the hemisphere caps
export const CAPSULE_HALF_HEIGHT = 0.5
export const CAPSULE_RADIUS      = 0.35

// Spawn position — 1 pixel in map.png = 32 world units
// e.g. to spawn at pixel (col, row): SPAWN_X = col*32, SPAWN_Z = row*32
const SPAWN_X      = 5 * 32  // pixel (5, 5) on map.png — plains zone
const SPAWN_Z      = 5 * 32
const SPAWN_HEIGHT = 2 // drop height above ground — keep above 0.85 (capsule half-height) to avoid starting inside terrain

export class PlayerEntity {
    readonly body: RAPIER.RigidBody
    // Anchor object used to read the body's world position each frame
    readonly anchor = new THREE.Object3D()

    constructor(physics: PhysicsWorld) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(SPAWN_X, SPAWN_HEIGHT, SPAWN_Z)
            // Lock rotations on X and Z — prevents capsule from tipping
            .lockRotations()

        this.body = physics.createRigidBody(bodyDesc)

        const colliderDesc = RAPIER.ColliderDesc
            .capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
            // Friction helps with walking feel
            .setFriction(1.0)
            .setRestitution(0.0)

        physics.createCollider(colliderDesc, this.body)
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
        return new THREE.Vector3(SPAWN_X, SPAWN_HEIGHT, SPAWN_Z)
    }
}
