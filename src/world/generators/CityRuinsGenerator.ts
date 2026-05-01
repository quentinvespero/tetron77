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

// Creates a displaced non-indexed box geometry for building blocks.
// isCrown=true applies jagged broken-top displacement to the top face.
// Uses 6×4×6 subdivisions so wall surface noise has geometry to work with.
const makeBlock = (
    cx: number, cz: number,
    bw: number, bh: number, bd: number,
    vSeedBase: number, isCrown: boolean
): THREE.BufferGeometry => {
    const geo    = new THREE.BoxGeometry(bw, bh, bd, 6, 4, 6)
    const merged = mergeVertices(geo)
    geo.dispose()
    const bp     = merged.attributes.position as THREE.BufferAttribute
    const halfBH = bh / 2
    const halfBW = bw / 2
    const halfBD = bd / 2
    const doCol  = rng(cx, cz, vSeedBase)     > 0.4
    const colX   = rng(cx, cz, vSeedBase + 1) > 0.5

    for (let j = 0; j < bp.count; j++) {
        const vx = bp.getX(j), vy = bp.getY(j), vz = bp.getZ(j)
        const vs = vSeedBase + 10 + j * 3

        if (isCrown && vy > halfBH - 0.05) {
            // Jagged broken crown
            bp.setY(j, vy + (rng(cx, cz, vs)     - 0.5) * bh * 0.35)
            bp.setX(j, vx + (rng(cx, cz, vs + 1) - 0.5) * 0.4)
            bp.setZ(j, vz + (rng(cx, cz, vs + 2) - 0.5) * 0.4)
        } else if (vy < halfBH - 0.05 && vy > -halfBH + 0.05) {
            // Subtle concrete surface roughness on wall vertices
            bp.setX(j, vx + (rng(cx, cz, vs + 6) - 0.5) * bw * 0.022)
            bp.setZ(j, vz + (rng(cx, cz, vs + 7) - 0.5) * bd * 0.022)
        }

        // Blown-out wall corner (uses original vx/vz for check, consistent with original)
        if (doCol) {
            if (colX && vx > halfBW - 0.05) {
                bp.setX(j, vx - (rng(cx, cz, vs + 3) * 1.5 + 0.5))
                bp.setY(j, bp.getY(j) - rng(cx, cz, vs + 4) * bh * 0.2)
            } else if (!colX && vz > halfBD - 0.05) {
                bp.setZ(j, vz - (rng(cx, cz, vs + 3) * 1.5 + 0.5))
                bp.setY(j, bp.getY(j) - rng(cx, cz, vs + 4) * bh * 0.2)
            }
        }
    }
    bp.needsUpdate = true
    const flat = merged.toNonIndexed()
    merged.dispose()
    flat.computeVertexNormals()
    return flat
}

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
        applyTerrainVertexColors(groundGeo)

        const ground = new THREE.Mesh(groundGeo, MAT_GROUND_VC)
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
            const ry   = (rng(cx, cz, seed + 6) - 0.5) * 0.17
            const groundY = Math.min(
                sampleBlended(worldX + lx - fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx - fw / 2, worldZ + lz + fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz + fd / 2, mapParser),
            )

            // Variant selection: 30% stepped, 50% L-shape, 20% plain box
            const variantRoll = rng(cx, cz, seed + 20)
            const isStepped   = variantRoll < 0.30
            const isLShape    = !isStepped && variantRoll < 0.80

            if (isStepped) {
                // Two-tier setback: wide base + narrower upper section
                const h1  = h * 0.62
                const h2  = h * 0.38
                const fw2 = fw * (0.55 + rng(cx, cz, seed + 21) * 0.2)
                const fd2 = fd * (0.55 + rng(cx, cz, seed + 22) * 0.2)
                // Upper block sits slightly off-center for an asymmetric ruin look
                const ux  = (rng(cx, cz, seed + 23) - 0.5) * (fw - fw2) * 0.4
                const uz  = (rng(cx, cz, seed + 24) - 0.5) * (fd - fd2) * 0.4
                // Rotate offset by building yaw so it stays aligned
                const uxW = ux * Math.cos(ry) - uz * Math.sin(ry)
                const uzW = ux * Math.sin(ry) + uz * Math.cos(ry)

                const baseGeo  = makeBlock(cx, cz, fw, h1, fd, 1000000 + i * 100000, false)
                const baseMesh = new THREE.Mesh(baseGeo, MAT_RUIN)
                baseMesh.position.set(worldX + lx, groundY + h1 / 2, worldZ + lz)
                baseMesh.rotation.y = ry
                baseMesh.castShadow = baseMesh.receiveShadow = true
                meshes.push(baseMesh)
                bodyDescs.push({
                    body: RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(worldX + lx, groundY + h1 / 2, worldZ + lz)
                        .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                    collider: RAPIER.ColliderDesc.cuboid(fw / 2, h1 / 2, fd / 2),
                })

                const upperGeo  = makeBlock(cx, cz, fw2, h2, fd2, 1100000 + i * 100000, true)
                const upperMesh = new THREE.Mesh(upperGeo, MAT_RUIN)
                upperMesh.position.set(worldX + lx + uxW, groundY + h1 + h2 / 2, worldZ + lz + uzW)
                upperMesh.rotation.y = ry
                upperMesh.castShadow = upperMesh.receiveShadow = true
                meshes.push(upperMesh)
                bodyDescs.push({
                    body: RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(worldX + lx + uxW, groundY + h1 + h2 / 2, worldZ + lz + uzW)
                        .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                    collider: RAPIER.ColliderDesc.cuboid(fw2 / 2, h2 / 2, fd2 / 2),
                })

            } else if (isLShape) {
                // L-shaped footprint: main block + perpendicular arm extending in local +Z
                const armFw = fw * (0.5 + rng(cx, cz, seed + 21) * 0.35)
                const armFd = fd * (0.45 + rng(cx, cz, seed + 22) * 0.3)
                const armH  = h  * (0.55 + rng(cx, cz, seed + 23) * 0.35)
                // Arm's local-space center offset (extends in +Z from main block face)
                const localArmZ = (fd + armFd) / 2
                const armWX = -(localArmZ) * Math.sin(ry)
                const armWZ =  (localArmZ) * Math.cos(ry)

                const mainGeo  = makeBlock(cx, cz, fw, h, fd, 1000000 + i * 100000, true)
                const mainMesh = new THREE.Mesh(mainGeo, MAT_RUIN)
                mainMesh.position.set(worldX + lx, groundY + h / 2, worldZ + lz)
                mainMesh.rotation.y = ry
                mainMesh.castShadow = mainMesh.receiveShadow = true
                meshes.push(mainMesh)
                bodyDescs.push({
                    body: RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(worldX + lx, groundY + h / 2, worldZ + lz)
                        .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                    collider: RAPIER.ColliderDesc.cuboid(fw / 2, h / 2, fd / 2),
                })

                const armGeo  = makeBlock(cx, cz, armFw, armH, armFd, 1100000 + i * 100000, true)
                const armMesh = new THREE.Mesh(armGeo, MAT_RUIN)
                armMesh.position.set(worldX + lx + armWX, groundY + armH / 2, worldZ + lz + armWZ)
                armMesh.rotation.y = ry
                armMesh.castShadow = armMesh.receiveShadow = true
                meshes.push(armMesh)
                bodyDescs.push({
                    body: RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(worldX + lx + armWX, groundY + armH / 2, worldZ + lz + armWZ)
                        .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                    collider: RAPIER.ColliderDesc.cuboid(armFw / 2, armH / 2, armFd / 2),
                })

            } else {
                // Plain single-block ruin
                const geo  = makeBlock(cx, cz, fw, h, fd, 1000000 + i * 100000, true)
                const mesh = new THREE.Mesh(geo, MAT_RUIN)
                mesh.position.set(worldX + lx, groundY + h / 2, worldZ + lz)
                mesh.rotation.y = ry
                mesh.castShadow = mesh.receiveShadow = true
                meshes.push(mesh)
                bodyDescs.push({
                    body: RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(worldX + lx, groundY + h / 2, worldZ + lz)
                        .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                    collider: RAPIER.ColliderDesc.cuboid(fw / 2, h / 2, fd / 2),
                })
            }

            // Rubble piles scattered at the building base — visual only, no physics
            const rubbleCount = 3 + Math.floor(rng(cx, cz, seed + 200) * 4)
            for (let r = 0; r < rubbleCount; r++) {
                const rs     = seed + 200 + r * 10
                const radius = 0.3 + rng(cx, cz, rs)     * 0.7
                const ang    = rng(cx, cz, rs + 1) * Math.PI * 2
                const dist   = fw / 2 + 0.3 + rng(cx, cz, rs + 2) * 1.5
                const rpx    = lx + Math.cos(ang) * dist
                const rpz    = lz + Math.sin(ang) * dist
                const rGY    = sampleBlended(worldX + rpx, worldZ + rpz, mapParser)
                const xScale = 1.0 + rng(cx, cz, rs + 3) * 0.8
                const yScale = 0.25 + rng(cx, cz, rs + 4) * 0.2
                const zScale = 1.0 + rng(cx, cz, rs + 5) * 0.8

                const rIcoGeo = new THREE.IcosahedronGeometry(radius, 1)
                rIcoGeo.scale(xScale, yScale, zScale)
                const rGeo = mergeVertices(rIcoGeo)
                rIcoGeo.dispose()
                const rPos = rGeo.attributes.position as THREE.BufferAttribute
                for (let j = 0; j < rPos.count; j++) {
                    const vs = i * 5000 + r * 500 + j * 3 + 20000
                    rPos.setX(j, rPos.getX(j) * (1 + (rng(cx, cz, vs)     - 0.5) * 0.6))
                    rPos.setY(j, rPos.getY(j) * (1 + (rng(cx, cz, vs + 1) - 0.5) * 0.6))
                    rPos.setZ(j, rPos.getZ(j) * (1 + (rng(cx, cz, vs + 2) - 0.5) * 0.6))
                }
                rPos.needsUpdate = true
                const rFlatGeo = rGeo.toNonIndexed()
                rGeo.dispose()
                rFlatGeo.computeVertexNormals()

                const rMesh = new THREE.Mesh(rFlatGeo, MAT_RUIN)
                rMesh.position.set(worldX + rpx, rGY + radius * yScale, worldZ + rpz)
                rMesh.castShadow    = true
                rMesh.receiveShadow = true
                meshes.push(rMesh)
            }

            // Rebar stubs protruding from building top — visual only, no physics
            const rebarCount = 2 + Math.floor(rng(cx, cz, seed + 700) * 3)
            for (let r = 0; r < rebarCount; r++) {
                const rs     = seed + 700 + r * 10
                const rpx    = lx + (rng(cx, cz, rs + 1) - 0.5) * fw * 0.7
                const rpz    = lz + (rng(cx, cz, rs + 2) - 0.5) * fd * 0.7
                const rebarH = 0.4 + rng(cx, cz, rs + 3) * 0.8
                const tiltX  = (rng(cx, cz, rs + 4) - 0.5) * 0.26  // ±15°
                const tiltZ  = (rng(cx, cz, rs + 5) - 0.5) * 0.26

                const rebarGeo  = new THREE.CylinderGeometry(0.02, 0.02, rebarH, 8)
                const rebarMesh = new THREE.Mesh(rebarGeo, MAT_ROCK)
                rebarMesh.position.set(worldX + rpx, groundY + h + rebarH / 2, worldZ + rpz)
                rebarMesh.rotation.set(tiltX, rng(cx, cz, rs + 6) * Math.PI * 2, tiltZ)
                rebarMesh.castShadow = true
                meshes.push(rebarMesh)
            }

            // Vertical facade fins — visual only, no physics; brutalist panelized look, skip for L-shape (arm covers that face)
            if (!isLShape) {
                const finCount = 1 + Math.floor(rng(cx, cz, seed + 900) * 3)
                const finH     = h * 0.85
                for (let f = 0; f < finCount; f++) {
                    const spacing = fw / (finCount + 1)
                    const localX  = -fw / 2 + spacing * (f + 1)
                    const localZ  = fd / 2 + 0.08
                    const finPx   = lx + localX * Math.cos(ry) - localZ * Math.sin(ry)
                    const finPz   = lz + localX * Math.sin(ry) + localZ * Math.cos(ry)

                    const finGeo  = new THREE.BoxGeometry(0.15, finH, 0.2)
                    const finMesh = new THREE.Mesh(finGeo, MAT_RUIN)
                    finMesh.position.set(worldX + finPx, groundY + finH / 2, worldZ + finPz)
                    finMesh.rotation.y = ry
                    finMesh.castShadow = true
                    meshes.push(finMesh)
                }
            }
        }

        // Broken wall slabs — thin tall panels tilted at steep angles
        const wallCount = 1 + Math.floor(rng(cx, cz, 80) * 3)
        for (let i = 0; i < wallCount; i++) {
            const seed   = i * 10 + 400
            const ww     = 3 + rng(cx, cz, seed + 1) * 3   // 3–6 wide
            const wh     = 4 + rng(cx, cz, seed + 2) * 4   // 4–8 tall
            const lx     = rng(cx, cz, seed + 3) * (CHUNK_SIZE - ww - 2) + ww / 2 + 1
            const lz     = rng(cx, cz, seed + 4) * (CHUNK_SIZE - 4) + 2
            const tiltZ  = (0.26 + rng(cx, cz, seed + 5) * 0.44) * (rng(cx, cz, seed + 6) > 0.5 ? 1 : -1)
            const ry     = rng(cx, cz, seed + 7) * Math.PI
            const groundY = sampleBlended(worldX + lx, worldZ + lz, mapParser)

            // 3 width segments for broken top edge; 3 height segments for crack displacement
            const geo     = new THREE.BoxGeometry(ww, wh, 0.4, 3, 3, 1)
            const merged  = mergeVertices(geo)
            geo.dispose()
            const wallPos = merged.attributes.position as THREE.BufferAttribute
            const hasCrack = rng(cx, cz, seed + 8) > 0.7   // 30% chance of stress fracture
            const crackY   = -wh / 2 + (0.3 + rng(cx, cz, seed + 9) * 0.4) * wh

            for (let j = 0; j < wallPos.count; j++) {
                const vy = wallPos.getY(j)
                const vs = i * 1000 + j * 3 + 40000
                if (vy > wh / 2 - 0.05) {
                    wallPos.setY(j, vy + (rng(cx, cz, vs)     - 0.5) * wh * 0.25)
                    wallPos.setX(j, wallPos.getX(j) + (rng(cx, cz, vs + 1) - 0.5) * 0.3)
                }
                // Bulge along crack line — stress fracture
                if (hasCrack && Math.abs(vy - crackY) < wh * 0.12) {
                    wallPos.setZ(j, wallPos.getZ(j) + (rng(cx, cz, vs + 2) - 0.5) * 0.3)
                }
            }
            wallPos.needsUpdate = true
            const flatGeo = merged.toNonIndexed()
            merged.dispose()
            flatGeo.computeVertexNormals()

            const mesh = new THREE.Mesh(flatGeo, MAT_RUIN)
            mesh.position.set(worldX + lx, groundY + wh / 2, worldZ + lz)
            mesh.rotation.set(0, ry, tiltZ)
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, tiltZ))
            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldX + lx, groundY + wh / 2, worldZ + lz)
                    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
                collider: RAPIER.ColliderDesc.cuboid(ww / 2, wh / 2, 0.2),
            })
        }

        // Floor debris slabs — wide flat panels with chipped perimeter edges
        const floorCount = 1 + Math.floor(rng(cx, cz, 90) * 2)
        for (let i = 0; i < floorCount; i++) {
            const seed    = i * 10 + 500
            const fw      = 6 + rng(cx, cz, seed + 1) * 6   // 6–12 wide
            const fd      = 6 + rng(cx, cz, seed + 2) * 6   // 6–12 deep
            const fh      = 0.25 + rng(cx, cz, seed + 3) * 0.2
            const lx      = rng(cx, cz, seed + 4) * (CHUNK_SIZE - fw - 2) + fw / 2 + 1
            const lz      = rng(cx, cz, seed + 5) * (CHUNK_SIZE - fd - 2) + fd / 2 + 1
            const ry      = rng(cx, cz, seed + 6) * Math.PI
            const groundY = Math.min(
                sampleBlended(worldX + lx - fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz - fd / 2, mapParser),
                sampleBlended(worldX + lx - fw / 2, worldZ + lz + fd / 2, mapParser),
                sampleBlended(worldX + lx + fw / 2, worldZ + lz + fd / 2, mapParser),
            )

            const geo      = new THREE.BoxGeometry(fw, fh, fd, 3, 1, 3)
            const merged   = mergeVertices(geo)
            geo.dispose()
            const floorPos = merged.attributes.position as THREE.BufferAttribute
            for (let j = 0; j < floorPos.count; j++) {
                const vx = floorPos.getX(j)
                const vz = floorPos.getZ(j)
                const vs = i * 1000 + j * 3 + 30000
                // Chip the slab perimeter edges
                if (Math.abs(vx) > fw / 2 - 0.3 || Math.abs(vz) > fd / 2 - 0.3) {
                    floorPos.setY(j, floorPos.getY(j) + (rng(cx, cz, vs)     - 0.5) * 0.4)
                    floorPos.setX(j, vx                + (rng(cx, cz, vs + 1) - 0.5) * 0.2)
                    floorPos.setZ(j, vz                + (rng(cx, cz, vs + 2) - 0.5) * 0.2)
                }
            }
            floorPos.needsUpdate = true
            const flatGeo = merged.toNonIndexed()
            merged.dispose()
            flatGeo.computeVertexNormals()

            const mesh = new THREE.Mesh(flatGeo, MAT_RUIN)
            // Slightly sunken — looks like it collapsed in from above
            mesh.position.set(worldX + lx, groundY + fh / 2 - 0.1, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow    = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldX + lx, groundY + fh / 2 - 0.1, worldZ + lz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(fw / 2, fh / 2, fd / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
