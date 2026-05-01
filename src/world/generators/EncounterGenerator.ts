import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import type { MapParser } from '../MapParser'
import { CHUNK_SIZE } from '../constants'
import { TERRAIN_SEGS, buildChunkHeights, sampleBlended } from '../TerrainSampler'
import { rng } from './generatorUtils'
import { MAT_GROUND_VC, MAT_ROCK, applyTerrainVertexColors } from '@rendering/materials'

export class EncounterGenerator implements BaseGenerator {
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
        applyTerrainVertexColors(groundGeo)

        const ground = new THREE.Mesh(groundGeo, MAT_GROUND_VC)
        ground.position.set(centerX, 0, centerZ)
        ground.receiveShadow = true
        meshes.push(ground)

        bodyDescs.push({
            body:     RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ),
            collider: RAPIER.ColliderDesc.heightfield(TERRAIN_SEGS, TERRAIN_SEGS, physicsHeights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }),
        })

        // Scattered rubble — 5 to 10 pieces, mix of lumpy chunks and flat slab fragments
        const count = 5 + Math.floor(rng(cx, cz, 0) * 6)
        for (let i = 0; i < count; i++) {
            const seed = i * 10
            const w    = 1 + rng(cx, cz, seed + 1) * 2
            const d    = 1 + rng(cx, cz, seed + 3) * 2
            const lx   = rng(cx, cz, seed + 4) * (CHUNK_SIZE - 4) + 2
            const lz   = rng(cx, cz, seed + 5) * (CHUNK_SIZE - 4) + 2
            const ry   = rng(cx, cz, seed + 6) * Math.PI * 2

            // Keep center arena clear for enemy combat
            const dx = lx - CHUNK_SIZE / 2
            const dz = lz - CHUNK_SIZE / 2
            if (dx * dx + dz * dz < 64) continue   // skip within 8-unit radius of center

            // Mix types: flat slab (man-made debris) vs lumpy chunk (organic stone)
            const isSlab = rng(cx, cz, seed + 7) > 0.5
            const h      = isSlab
                ? 0.15 + rng(cx, cz, seed + 2) * 0.2   // flat panel: 0.15–0.35 tall
                : 0.5  + rng(cx, cz, seed + 2) * 1.5   // lumpy chunk: 0.5–2 tall

            const groundY = Math.min(
                sampleBlended(worldX + lx - w / 2, worldZ + lz - d / 2, mapParser),
                sampleBlended(worldX + lx + w / 2, worldZ + lz - d / 2, mapParser),
                sampleBlended(worldX + lx - w / 2, worldZ + lz + d / 2, mapParser),
                sampleBlended(worldX + lx + w / 2, worldZ + lz + d / 2, mapParser),
            )

            // detail=1 gives 80 faces — enough geometry for natural-looking displacement
            const r      = Math.cbrt(w * h * d) / 2
            const icoGeo = new THREE.IcosahedronGeometry(r, 1)
            icoGeo.scale(w / (r * 2), h / (r * 2), d / (r * 2))
            const geo    = mergeVertices(icoGeo)  // deduplicate verts → no torn edges on displacement
            icoGeo.dispose()

            const rockPos = geo.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < rockPos.count; j++) {
                const vSeed = i * 500 + j * 3
                rockPos.setX(j, rockPos.getX(j) * (1 + (rng(cx, cz, vSeed)     - 0.5) * 0.4))
                rockPos.setY(j, rockPos.getY(j) * (1 + (rng(cx, cz, vSeed + 1) - 0.5) * 0.4))
                rockPos.setZ(j, rockPos.getZ(j) * (1 + (rng(cx, cz, vSeed + 2) - 0.5) * 0.4))
            }
            rockPos.needsUpdate = true
            const flatGeo = geo.toNonIndexed()
            geo.dispose()
            flatGeo.computeVertexNormals()

            const mesh = new THREE.Mesh(flatGeo, MAT_ROCK)
            mesh.position.set(worldX + lx, groundY + h / 2, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldX + lx, groundY + h / 2, worldZ + lz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
