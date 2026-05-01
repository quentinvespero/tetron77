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

const spawnRock = (
    cx: number, cz: number, worldX: number, worldZ: number,
    lx: number, lz: number, w: number, d: number, h: number,
    ry: number, seedBase: number, dispRange: number,
    mapParser: MapParser, meshes: THREE.Mesh[], bodyDescs: GeneratedContent['bodyDescs']
) => {
    const groundY = Math.min(
        sampleBlended(worldX + lx - w / 2, worldZ + lz - d / 2, mapParser),
        sampleBlended(worldX + lx + w / 2, worldZ + lz - d / 2, mapParser),
        sampleBlended(worldX + lx - w / 2, worldZ + lz + d / 2, mapParser),
        sampleBlended(worldX + lx + w / 2, worldZ + lz + d / 2, mapParser),
    )

    const r      = Math.cbrt(w * h * d) / 2
    const icoGeo = new THREE.IcosahedronGeometry(r, 1)
    icoGeo.scale(w / (r * 2), h / (r * 2), d / (r * 2))
    const geo    = mergeVertices(icoGeo)
    icoGeo.dispose()

    const rockPos = geo.attributes.position as THREE.BufferAttribute
    for (let j = 0; j < rockPos.count; j++) {
        const vs = seedBase + j * 3
        rockPos.setX(j, rockPos.getX(j) * (1 + (rng(cx, cz, vs)     - 0.5) * dispRange))
        rockPos.setY(j, rockPos.getY(j) * (1 + (rng(cx, cz, vs + 1) - 0.5) * dispRange))
        rockPos.setZ(j, rockPos.getZ(j) * (1 + (rng(cx, cz, vs + 2) - 0.5) * dispRange))
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

            // Larger rocks get more dramatic surface variation
            const dispRange = h > 15 ? 0.44 : 0.30

            const typeRoll = rng(cx, cz, seed + 7)

            if (typeRoll < 0.15) {
                // Flat bedrock slab variant — exposed ledge look
                const slabW = w * (1.2 + rng(cx, cz, seed + 8) * 0.6)
                const slabD = d * (1.2 + rng(cx, cz, seed + 9) * 0.6)
                const slabH = h * 0.18   // very flat
                spawnRock(cx, cz, worldX, worldZ, lx, lz, slabW, slabD, slabH, ry, i * 1000, 0.08, mapParser, meshes, bodyDescs)
            } else {
                // Standard displaced icosahedron rock
                spawnRock(cx, cz, worldX, worldZ, lx, lz, w, d, h, ry, i * 1000, dispRange, mapParser, meshes, bodyDescs)

                // 50% chance of satellite rocks forming a cluster
                if (typeRoll > 0.65) {
                    const satCount = 1 + Math.floor(rng(cx, cz, seed + 8) * 2)   // 1 or 2
                    for (let s = 0; s < satCount; s++) {
                        const ss      = seed + 8 + s * 6 + 100
                        const satAng  = rng(cx, cz, ss + 1) * Math.PI * 2
                        const satDist = w * 0.4 + rng(cx, cz, ss + 2) * w * 0.4
                        const satLx   = lx + Math.cos(satAng) * satDist
                        const satLz   = lz + Math.sin(satAng) * satDist
                        const satW    = w * (0.3 + rng(cx, cz, ss + 3) * 0.4)
                        const satD    = d * (0.3 + rng(cx, cz, ss + 4) * 0.4)
                        const satH    = h * (0.3 + rng(cx, cz, ss + 5) * 0.4)
                        const satRy   = rng(cx, cz, ss + 6) * Math.PI
                        spawnRock(cx, cz, worldX, worldZ, satLx, satLz, satW, satD, satH, satRy, i * 1000 + s * 10000 + 100000, dispRange, mapParser, meshes, bodyDescs)
                    }
                }
            }
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
