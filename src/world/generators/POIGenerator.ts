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
            const ry     = rng(cx, cz, seed + 4) * Math.PI * 2

            let finalGeo: THREE.BufferGeometry

            if (s === segCount - 1) {
                // Topmost segment — add broken crown displacement
                const topGeo = new THREE.CylinderGeometry(sw * 0.45, sw * 0.5, sh, 12, 2)
                const merged = mergeVertices(topGeo)
                topGeo.dispose()
                const topPos = merged.attributes.position as THREE.BufferAttribute
                for (let j = 0; j < topPos.count; j++) {
                    if (topPos.getY(j) > sh / 2 - 0.05) {
                        const vs = s * 1000 + j * 3 + 50000
                        topPos.setY(j, topPos.getY(j) + (rng(cx, cz, vs)     - 0.5) * sh * 0.15)
                        topPos.setX(j, topPos.getX(j) + (rng(cx, cz, vs + 1) - 0.5) * 0.3)
                        topPos.setZ(j, topPos.getZ(j) + (rng(cx, cz, vs + 2) - 0.5) * 0.3)
                    }
                }
                topPos.needsUpdate = true
                finalGeo = merged.toNonIndexed()
                merged.dispose()
                finalGeo.computeVertexNormals()
            } else {
                // 12-sided cylinder: round enough to read as a cylinder, not a hexagon
                finalGeo = new THREE.CylinderGeometry(sw * 0.45, sw * 0.5, sh, 12)
            }

            const mesh = new THREE.Mesh(finalGeo, MAT_RUIN)
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

        // Spire remnant atop the tower — visual only, no physics; 30% chance
        if (rng(cx, cz, 95) < 0.3) {
            const spireH   = 2 + rng(cx, cz, 96) * 5
            const spireGeo = new THREE.CylinderGeometry(0.08, 0.14, spireH, 8)
            const spireMesh = new THREE.Mesh(spireGeo, MAT_ROCK)
            const tiltX = (rng(cx, cz, 97) - 0.5) * 0.35
            const tiltZ = (rng(cx, cz, 98) - 0.5) * 0.35
            spireMesh.position.set(centerX + 0.3, floorY + spireH / 2, centerZ + 0.3)
            spireMesh.rotation.set(tiltX, 0, tiltZ)
            spireMesh.castShadow = true
            meshes.push(spireMesh)
        }

        // Tower base rubble scatter — visual only, no physics
        const towerRubbleCount = 4 + Math.floor(rng(cx, cz, 90) * 5)
        for (let r = 0; r < towerRubbleCount; r++) {
            const rs     = r * 10 + 500
            const radius = 0.3 + rng(cx, cz, rs)     * 0.8
            const ang    = rng(cx, cz, rs + 1) * Math.PI * 2
            const dist   = baseSize / 2 + 0.5 + rng(cx, cz, rs + 2) * 4
            const rpx    = centerX + Math.cos(ang) * dist
            const rpz    = centerZ + Math.sin(ang) * dist
            const rGY    = sampleBlended(rpx, rpz, mapParser)
            const xScale = 1.0 + rng(cx, cz, rs + 3) * 0.8
            const yScale = 0.25 + rng(cx, cz, rs + 4) * 0.2
            const zScale = 1.0 + rng(cx, cz, rs + 5) * 0.8

            const rIcoGeo = new THREE.IcosahedronGeometry(radius, 1)
            rIcoGeo.scale(xScale, yScale, zScale)
            const rGeo = mergeVertices(rIcoGeo)
            rIcoGeo.dispose()
            const rPos = rGeo.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < rPos.count; j++) {
                const vs = r * 500 + j * 3 + 60000
                rPos.setX(j, rPos.getX(j) * (1 + (rng(cx, cz, vs)     - 0.5) * 0.6))
                rPos.setY(j, rPos.getY(j) * (1 + (rng(cx, cz, vs + 1) - 0.5) * 0.6))
                rPos.setZ(j, rPos.getZ(j) * (1 + (rng(cx, cz, vs + 2) - 0.5) * 0.6))
            }
            rPos.needsUpdate = true
            const rFlatGeo = rGeo.toNonIndexed()
            rGeo.dispose()
            rFlatGeo.computeVertexNormals()

            const rMesh = new THREE.Mesh(rFlatGeo, MAT_RUIN)
            rMesh.position.set(rpx, rGY + radius * yScale, rpz)
            rMesh.castShadow    = true
            rMesh.receiveShadow = true
            meshes.push(rMesh)
        }

        // 2–3 surrounding larger debris pieces
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
            const icoGeo = new THREE.IcosahedronGeometry(r, 1)
            icoGeo.scale(w / (r * 2), h / (r * 2), d / (r * 2))
            const geo    = mergeVertices(icoGeo)
            icoGeo.dispose()

            const rockPos = geo.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < rockPos.count; j++) {
                const vSeed = i * 500 + j * 3 + 300
                rockPos.setX(j, rockPos.getX(j) * (1 + (rng(cx, cz, vSeed)     - 0.5) * 0.35))
                rockPos.setY(j, rockPos.getY(j) * (1 + (rng(cx, cz, vSeed + 1) - 0.5) * 0.35))
                rockPos.setZ(j, rockPos.getZ(j) * (1 + (rng(cx, cz, vSeed + 2) - 0.5) * 0.35))
            }
            rockPos.needsUpdate = true
            const flatGeo = geo.toNonIndexed()
            geo.dispose()
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
