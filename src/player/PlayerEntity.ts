import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { PhysicsWorld } from '@physics/PhysicsWorld'

// Capsule dimensions — half-height excludes the hemisphere caps
export const CAPSULE_HALF_HEIGHT = 0.5
export const CAPSULE_RADIUS      = 0.35
const SPAWN_HEIGHT        = 4 // Units above y=0 to spawn, ensuring we land on a chunk

export class PlayerEntity {
    readonly body: RAPIER.RigidBody
    // Anchor object used to read the body's world position each frame
    readonly anchor = new THREE.Object3D()

    constructor(physics: PhysicsWorld) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, SPAWN_HEIGHT, 0)
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
        return new THREE.Vector3(0, SPAWN_HEIGHT, 0)
    }
}
