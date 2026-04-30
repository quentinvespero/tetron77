import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import type { MapParser } from '../MapParser'
import { CHUNK_SIZE } from '../constants'
import { TERRAIN_SEGS, buildChunkHeights, sampleBlended } from '../TerrainSampler'
import { rng } from './generatorUtils'
import { MAT_GROUND, MAT_RUIN } from '@rendering/materials'

export class CityRuinsGenerator implements BaseGenerator {
    generate(coord: ChunkCoord, mapParser: MapParser): GeneratedContent {
        const { cx, cz } = coord
        const worldX  = cx * CHUNK_SIZE
        const worldZ  = cz * CHUNK_SIZE
        const centerX = worldX + CHUNK_SIZE / 2
        const centerZ = worldZ + CHUNK_SIZE / 2

        const meshes:    THREE.Mesh[]                  = []
        const bodyDescs: GeneratedContent['bodyDescs'] = []

        const { visual: heights, physics: physicsHeights } = buildChunkHeights(centerX, centerZ, mapParser)

        const groundGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_SEGS, TERRAIN_SEGS)
        groundGeo.rotateX(-Math.PI / 2)

        const pos = groundGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i]!)
        pos.needsUpdate = true
        groundGeo.computeVertexNormals()

        const ground = new THREE.Mesh(groundGeo, MAT_GROUND)
        ground.position.set(centerX, 0, centerZ)
        ground.receiveShadow = true
        meshes.push(ground)

        bodyDescs.push({
            body:     RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ),
            collider: RAPIER.ColliderDesc.heightfield(TERRAIN_SEGS, TERRAIN_SEGS, physicsHeights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }),
        })

        // Ruined buildings — 2 to 5 per chunk
        const count = 2 + Math.floor(rng(cx, cz, 0) * 4)
        for (let i = 0; i < count; i++) {
            const seed = i * 10
            const fw   = 3 + rng(cx, cz, seed + 1) * 5   // footprint width  3–8
            const fd   = 3 + rng(cx, cz, seed + 2) * 5   // footprint depth  3–8
            const h    = 5 + rng(cx, cz, seed + 3) * 15  // height           5–20
            const lx   = rng(cx, cz, seed + 4) * (CHUNK_SIZE - fw - 2) + fw / 2 + 1
            const lz   = rng(cx, cz, seed + 5) * (CHUNK_SIZE - fd - 2) + fd / 2 + 1
            // Slight random tilt — ruined look (max ~5°)
            const ry   = (rng(cx, cz, seed + 6) - 0.5) * 0.17
            // Sample all 4 footprint corners, use min — prevents floating on slopes
            const groundY = Math.min(
                sampleBlended(worldX + lx - fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx - fw / 2, worldZ + lz + fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz + fd / 2, mapParser),
            )

            const geo  = new THREE.BoxGeometry(fw, h, fd)
            const mesh = new THREE.Mesh(geo, MAT_RUIN)
            mesh.position.set(worldX + lx, groundY + h / 2, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldX + lx, groundY + h / 2, worldZ + lz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(fw / 2, h / 2, fd / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
