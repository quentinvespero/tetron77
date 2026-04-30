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

export class MountainGenerator implements BaseGenerator {
    generate(coord: ChunkCoord, mapParser: MapParser): GeneratedContent {
        const { cx, cz } = coord
        const worldX  = cx * CHUNK_SIZE
        const worldZ  = cz * CHUNK_SIZE
        const centerX = worldX + CHUNK_SIZE / 2
        const centerZ = worldZ + CHUNK_SIZE / 2

        const meshes:    THREE.Mesh[]                   = []
        const bodyDescs: GeneratedContent['bodyDescs']  = []

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

        // Rock formations — 4 to 8 per chunk, placed on top of terrain
        const count = 4 + Math.floor(rng(cx, cz, 0) * 5)
        for (let i = 0; i < count; i++) {
            const seed = i * 10
            const lx   = rng(cx, cz, seed + 1) * (CHUNK_SIZE - 8) + 4
            const lz   = rng(cx, cz, seed + 2) * (CHUNK_SIZE - 8) + 4
            const w    = 3 + rng(cx, cz, seed + 3) * 7    // 3–10 wide
            const d    = 3 + rng(cx, cz, seed + 4) * 7    // 3–10 deep
            const h    = 6 + rng(cx, cz, seed + 5) * 19   // 6–25 tall
            const ry   = rng(cx, cz, seed + 6) * Math.PI
            const groundY = Math.min(
                sampleBlended(worldX + lx - w / 2, worldZ + lz - d / 2, mapParser),
                sampleBlended(worldX + lx + w / 2, worldZ + lz - d / 2, mapParser),
                sampleBlended(worldX + lx - w / 2, worldZ + lz + d / 2, mapParser),
                sampleBlended(worldX + lx + w / 2, worldZ + lz + d / 2, mapParser),
            )

            // Icosahedron gives organic, faceted silhouette instead of a box
            const r      = Math.cbrt(w * h * d) / 2
            const icoGeo = new THREE.IcosahedronGeometry(r, 1)
            icoGeo.scale(w / (r * 2), h / (r * 2), d / (r * 2))
            // mergeVertices deduplicates coincident verts → indexed geometry.
            // Without this, IcosahedronGeometry is non-indexed (each triangle owns
            // its own vertex copies), so adjacent faces get different displacements
            // → triangles tear apart at shared edges.
            const geo    = mergeVertices(icoGeo)

            // Randomly displace each vertex ±15% for unique rock shapes
            const rockPos = geo.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < rockPos.count; j++) {
                const vSeed = i * 1000 + j * 3
                rockPos.setX(j, rockPos.getX(j) * (1 + (rng(cx, cz, vSeed)     - 0.5) * 0.3))
                rockPos.setY(j, rockPos.getY(j) * (1 + (rng(cx, cz, vSeed + 1) - 0.5) * 0.3))
                rockPos.setZ(j, rockPos.getZ(j) * (1 + (rng(cx, cz, vSeed + 2) - 0.5) * 0.3))
            }
            rockPos.needsUpdate = true
            // toNonIndexed splits vertices per face for flat/faceted shading
            const flatGeo = geo.toNonIndexed()
            flatGeo.computeVertexNormals()

            const mesh = new THREE.Mesh(flatGeo, MAT_ROCK)
            mesh.position.set(worldX + lx, groundY + h / 2, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            // Physics stays as cuboid — close enough for collision, much cheaper than trimesh
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
