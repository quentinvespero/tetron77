import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import { CHUNK_SIZE } from '../ChunkManager'
import { MAT_GROUND, MAT_ROCK } from '@rendering/materials'

const rng = (cx: number, cz: number, i: number): number => {
    const x = Math.sin(cx * 127.1 + cz * 311.7 + i * 74.1) * 10000
    return x - Math.floor(x)
}

export class EncounterGenerator implements BaseGenerator {
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

        // Scattered rubble — 5 to 10 small pieces spread across the open area
        const count = 5 + Math.floor(rng(cx, cz, 0) * 6)
        for (let i = 0; i < count; i++) {
            const seed = i * 10
            const w  = 1 + rng(cx, cz, seed + 1) * 2   // 1–3 wide
            const h  = 0.5 + rng(cx, cz, seed + 2) * 1.5 // 0.5–2 tall
            const d  = 1 + rng(cx, cz, seed + 3) * 2   // 1–3 deep
            const lx = rng(cx, cz, seed + 4) * (CHUNK_SIZE - 4) + 2
            const lz = rng(cx, cz, seed + 5) * (CHUNK_SIZE - 4) + 2
            const ry = rng(cx, cz, seed + 6) * Math.PI * 2

            const geo  = new THREE.BoxGeometry(w, h, d)
            const mesh = new THREE.Mesh(geo, MAT_ROCK)
            mesh.position.set(worldX + lx, h / 2, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow   = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            bodyDescs.push({
                body: RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldX + lx, h / 2, worldZ + lz)
                    .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }),
                collider: RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
            })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
