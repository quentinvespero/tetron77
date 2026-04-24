import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import { CHUNK_SIZE } from '../ChunkManager'
import { MAT_GROUND } from '@rendering/materials'

export class PlainGenerator implements BaseGenerator {
    generate(coord: ChunkCoord): GeneratedContent {
        const worldX = coord.cx * CHUNK_SIZE
        const worldZ = coord.cz * CHUNK_SIZE

        // Flat terrain plane, centered on chunk world position
        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
        geometry.rotateX(-Math.PI / 2) // Make it horizontal (XZ plane)

        const mesh = new THREE.Mesh(geometry, MAT_GROUND)
        mesh.position.set(worldX + CHUNK_SIZE / 2, 0, worldZ + CHUNK_SIZE / 2)
        mesh.receiveShadow = true

        // Static ground collider — matches the visual plane exactly
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(worldX + CHUNK_SIZE / 2, 0, worldZ + CHUNK_SIZE / 2)

        // Thin cuboid: CHUNK_SIZE × 0.1 × CHUNK_SIZE
        const colliderDesc = RAPIER.ColliderDesc.cuboid(CHUNK_SIZE / 2, 0.05, CHUNK_SIZE / 2)

        return {
            meshes:              [mesh],
            bodyDescs:           [{ body: bodyDesc, collider: colliderDesc }],
            disposableMaterials: [], // MAT_GROUND is shared — never dispose it
        }
    }
}
