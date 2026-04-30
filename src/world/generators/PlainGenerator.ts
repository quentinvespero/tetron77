import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import type { MapParser } from '../MapParser'
import { CHUNK_SIZE } from '../constants'
import { TERRAIN_SEGS, buildChunkHeights } from '../TerrainSampler'
import { MAT_GROUND_VC, applyTerrainVertexColors } from '@rendering/materials'

export class PlainGenerator implements BaseGenerator {
    generate(coord: ChunkCoord, mapParser: MapParser): GeneratedContent {
        const centerX = coord.cx * CHUNK_SIZE + CHUNK_SIZE / 2
        const centerZ = coord.cz * CHUNK_SIZE + CHUNK_SIZE / 2

        const { visual: heights, physics: physicsHeights } = buildChunkHeights(centerX, centerZ, mapParser)

        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_SEGS, TERRAIN_SEGS)
        geometry.rotateX(-Math.PI / 2)

        const pos = geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i]!)
        pos.needsUpdate = true
        geometry.computeVertexNormals()
        applyTerrainVertexColors(geometry)

        const mesh = new THREE.Mesh(geometry, MAT_GROUND_VC)
        mesh.position.set(centerX, 0, centerZ)
        mesh.receiveShadow = true

        const bodyDesc     = RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ)
        const colliderDesc = RAPIER.ColliderDesc.heightfield(
            TERRAIN_SEGS, TERRAIN_SEGS, physicsHeights,
            { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE },
        )

        return {
            meshes:              [mesh],
            bodyDescs:           [{ body: bodyDesc, collider: colliderDesc }],
            disposableMaterials: [],
        }
    }
}
