import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ChunkCoord } from './ChunkCoord'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import type { BaseGenerator } from './generators/BaseGenerator'

export class Chunk {
    readonly coord: ChunkCoord
    private meshes:              THREE.Mesh[]       = []
    private bodies:              RAPIER.RigidBody[] = []
    private disposableMaterials: THREE.Material[]   = []

    constructor(coord: ChunkCoord) {
        this.coord = coord
    }

    build(
        scene: THREE.Scene,
        physics: PhysicsWorld,
        generator: BaseGenerator,
    ): void {
        const { meshes, bodyDescs, disposableMaterials } = generator.generate(this.coord)

        for (const mesh of meshes) {
            scene.add(mesh)
            this.meshes.push(mesh)
        }

        for (const { body: bodyDesc, collider: colliderDesc } of bodyDescs) {
            const body = physics.createRigidBody(bodyDesc)
            physics.createCollider(colliderDesc, body)
            this.bodies.push(body)
        }

        this.disposableMaterials = disposableMaterials
    }

    /**
     * Fully disposes this chunk — removes from scene, frees GPU memory,
     * and removes Rapier bodies. Must be called before discarding the chunk.
     */
    dispose(scene: THREE.Scene, physics: PhysicsWorld): void {
        for (const mesh of this.meshes) {
            scene.remove(mesh)
            mesh.geometry.dispose()
        }
        // Only dispose materials the generator explicitly marked as chunk-owned.
        // Shared singletons (e.g. MAT_GROUND) are excluded by the generator.
        for (const mat of this.disposableMaterials) mat.dispose()
        this.meshes              = []
        this.disposableMaterials = []

        for (const body of this.bodies) {
            physics.removeRigidBody(body)
        }
        this.bodies = []
    }
}
