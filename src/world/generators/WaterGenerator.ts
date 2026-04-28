import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import type { MapParser } from '../MapParser'
import { CHUNK_SIZE } from '../constants'
import { MAT_WATER } from '@rendering/materials'

export class WaterGenerator implements BaseGenerator {
    generate(coord: ChunkCoord, _mapParser: MapParser): GeneratedContent {
        const worldX  = coord.cx * CHUNK_SIZE
        const worldZ  = coord.cz * CHUNK_SIZE
        const centerX = worldX + CHUNK_SIZE / 2
        const centerZ = worldZ + CHUNK_SIZE / 2
        // Below sea level — matches ZONE_CONFIG baseY in TerrainSampler
        const y = -2

        const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
        geo.rotateX(-Math.PI / 2)
        const mesh = new THREE.Mesh(geo, MAT_WATER)
        mesh.position.set(centerX, y, centerZ)
        mesh.receiveShadow = true

        const body     = RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, y, centerZ)
        const collider = RAPIER.ColliderDesc.cuboid(CHUNK_SIZE / 2, 0.05, CHUNK_SIZE / 2)

        return {
            meshes:              [mesh],
            bodyDescs:           [{ body, collider }],
            disposableMaterials: [],
        }
    }
}
