import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import type { MapParser } from '../MapParser'
import { CHUNK_SIZE } from '../constants'
import { TERRAIN_SEGS, buildChunkHeights, sampleBlended } from '../TerrainSampler'
import { rng } from './generatorUtils'
import { MAT_GROUND_VC, MAT_RUIN, MAT_ROCK, applyTerrainVertexColors } from '@rendering/materials'

export class POIGenerator implements BaseGenerator {
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

        // Central ruined tower — hexagonal prism segments for a monolithic, angular feel
        const towerGroundY = sampleBlended(centerX, centerZ, mapParser)
        const segCount     = 3 + Math.floor(rng(cx, cz, 0) * 2)  // 3 or 4 segments
        const baseSize     = 5 + rng(cx, cz, 1) * 2               // 5–7 wide
        let   floorY       = towerGroundY

        for (let s = 0; s < segCount; s++) {
            const seed   = s * 10 + 100
            const scale  = 1 - s * 0.15                         // taper toward the top
            const sw     = baseSize * scale
            const sh     = 4 + rng(cx, cz, seed + 1) * 4       // 4–8 tall
            const ox     = (rng(cx, cz, seed + 2) - 0.5) * 1.5
            const oz     = (rng(cx, cz, seed + 3) - 0.5) * 1.5
            // Slight rotation offset per segment — crumbled, irregular look
            const ry     = rng(cx, cz, seed + 4) * Math.PI * 2

            // 6-sided cylinder: angular monolith, clearly not a box
            const geo  = new THREE.CylinderGeometry(sw * 0.45, sw * 0.5, sh, 6)
            const mesh = new THREE.Mesh(geo, MAT_RUIN)
            mesh.position.set(centerX + ox, floorY + sh / 2, centerZ + oz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(centerX + ox, floorY + sh / 2, centerZ + oz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(sw / 2, sh / 2, sw / 2),
            })

            floorY += sh
        }

        // 2–3 surrounding debris pieces — organic icosahedron chunks
        const debrisCount = 2 + Math.floor(rng(cx, cz, 50) * 2)
        for (let i = 0; i < debrisCount; i++) {
            const seed    = i * 10 + 200
            const w       = 1 + rng(cx, cz, seed + 1) * 3
            const h       = 0.5 + rng(cx, cz, seed + 2) * 2
            const d       = 1 + rng(cx, cz, seed + 3) * 3
            const dist    = 4 + rng(cx, cz, seed + 4) * 6
            const ang     = rng(cx, cz, seed + 5) * Math.PI * 2
            const px      = centerX + Math.cos(ang) * dist
            const pz      = centerZ + Math.sin(ang) * dist
            const ry      = rng(cx, cz, seed + 6) * Math.PI * 2
            const groundY = Math.min(
                sampleBlended(px - w / 2, pz - d / 2, mapParser),
                sampleBlended(px + w / 2, pz - d / 2, mapParser),
                sampleBlended(px - w / 2, pz + d / 2, mapParser),
                sampleBlended(px + w / 2, pz + d / 2, mapParser),
            )

            const r      = Math.cbrt(w * h * d) / 2
            const icoGeo = new THREE.IcosahedronGeometry(r, 0)
            icoGeo.scale(w / (r * 2), h / (r * 2), d / (r * 2))
            const geo    = mergeVertices(icoGeo)  // deduplicate verts → no torn edges on displacement

            const rockPos = geo.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < rockPos.count; j++) {
                const vSeed = i * 500 + j * 3 + 300
                rockPos.setX(j, rockPos.getX(j) * (1 + (rng(cx, cz, vSeed)     - 0.5) * 0.35))
                rockPos.setY(j, rockPos.getY(j) * (1 + (rng(cx, cz, vSeed + 1) - 0.5) * 0.35))
                rockPos.setZ(j, rockPos.getZ(j) * (1 + (rng(cx, cz, vSeed + 2) - 0.5) * 0.35))
            }
            rockPos.needsUpdate = true
            const flatGeo = geo.toNonIndexed()
            flatGeo.computeVertexNormals()

            const mesh = new THREE.Mesh(flatGeo, MAT_ROCK)
            mesh.position.set(px, groundY + h / 2, pz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(px, groundY + h / 2, pz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
