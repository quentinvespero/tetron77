import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import { CHUNK_SIZE } from '../ChunkManager'
import { MAT_GROUND, MAT_RUIN, MAT_ROCK } from '@rendering/materials'

const rng = (cx: number, cz: number, i: number): number => {
    const x = Math.sin(cx * 127.1 + cz * 311.7 + i * 74.1) * 10000
    return x - Math.floor(x)
}

export class POIGenerator implements BaseGenerator {
    generate(coord: ChunkCoord): GeneratedContent {
        const { cx, cz } = coord
        const worldX = cx * CHUNK_SIZE
        const worldZ = cz * CHUNK_SIZE
        const centerX = worldX + CHUNK_SIZE / 2
        const centerZ = worldZ + CHUNK_SIZE / 2

        const meshes: THREE.Mesh[] = []
        const bodyDescs: GeneratedContent['bodyDescs'] = []

        // Ground base
        const groundGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
        groundGeo.rotateX(-Math.PI / 2)
        const ground = new THREE.Mesh(groundGeo, MAT_GROUND)
        ground.position.set(centerX, 0, centerZ)
        ground.receiveShadow = true
        meshes.push(ground)
        bodyDescs.push({
            body:     RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ),
            collider: RAPIER.ColliderDesc.cuboid(CHUNK_SIZE / 2, 0.05, CHUNK_SIZE / 2),
        })

        // Central ruined tower — 3 or 4 stacked box segments
        const segCount  = 3 + Math.floor(rng(cx, cz, 0) * 2)  // 3 or 4 segments
        const baseSize  = 5 + rng(cx, cz, 1) * 2               // 5–7 wide
        let   floorY    = 0

        for (let s = 0; s < segCount; s++) {
            const seed  = s * 10 + 100
            const scale = 1 - s * 0.15                         // taper toward the top
            const sw    = baseSize * scale
            const sh    = 4 + rng(cx, cz, seed + 1) * 4       // 4–8 tall
            // Slight random horizontal drift per segment — looks crumbled
            const ox    = (rng(cx, cz, seed + 2) - 0.5) * 1.5
            const oz    = (rng(cx, cz, seed + 3) - 0.5) * 1.5

            const geo  = new THREE.BoxGeometry(sw, sh, sw)
            const mesh = new THREE.Mesh(geo, MAT_RUIN)
            mesh.position.set(centerX + ox, floorY + sh / 2, centerZ + oz)
            mesh.castShadow   = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body:     RAPIER.RigidBodyDesc.fixed().setTranslation(centerX + ox, floorY + sh / 2, centerZ + oz),
                collider: RAPIER.ColliderDesc.cuboid(sw / 2, sh / 2, sw / 2),
            })

            floorY += sh
        }

        // 2–3 surrounding debris pieces
        const debrisCount = 2 + Math.floor(rng(cx, cz, 50) * 2)
        for (let i = 0; i < debrisCount; i++) {
            const seed = i * 10 + 200
            const w    = 1 + rng(cx, cz, seed + 1) * 3
            const h    = 0.5 + rng(cx, cz, seed + 2) * 2
            const d    = 1 + rng(cx, cz, seed + 3) * 3
            // Place around the tower (within 4–10 units of center)
            const dist = 4 + rng(cx, cz, seed + 4) * 6
            const ang  = rng(cx, cz, seed + 5) * Math.PI * 2
            const px   = centerX + Math.cos(ang) * dist
            const pz   = centerZ + Math.sin(ang) * dist
            const ry   = rng(cx, cz, seed + 6) * Math.PI * 2

            const geo  = new THREE.BoxGeometry(w, h, d)
            const mesh = new THREE.Mesh(geo, MAT_ROCK)
            mesh.position.set(px, h / 2, pz)
            mesh.rotation.y = ry
            mesh.castShadow   = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(px, h / 2, pz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
