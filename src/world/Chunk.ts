import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ChunkCoord } from './ChunkCoord'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import type { BaseGenerator } from './generators/BaseGenerator'
import type { MapParser } from './MapParser'
import type { EnemyEntity } from '@enemies/EnemyEntity'

export class Chunk {
    readonly coord: ChunkCoord
    private meshes:              THREE.Mesh[]       = []
    private bodies:              RAPIER.RigidBody[] = []
    private disposableMaterials: THREE.Material[]   = []
    private enemies:             EnemyEntity[]      = []

    constructor(coord: ChunkCoord) {
        this.coord = coord
    }

    build(
        scene: THREE.Scene,
        physics: PhysicsWorld,
        generator: BaseGenerator,
        mapParser: MapParser,
    ): void {
        const { meshes, bodyDescs, disposableMaterials } = generator.generate(this.coord, mapParser)

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

    spawnEnemies(enemies: EnemyEntity[]): void {
        if (this.enemies.length > 0) throw new Error('spawnEnemies called twice on the same chunk')
        this.enemies = enemies
    }

    getEnemies(): ReadonlyArray<EnemyEntity> {
        return this.enemies
    }

    purgeDeadEnemies(): void {
        this.enemies = this.enemies.filter(e => !e.isFullyDead)
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

        for (const enemy of this.enemies) {
            enemy.removeFromScene(scene)
        }
        this.enemies = []
    }
}
