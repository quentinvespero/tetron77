import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { BaseGenerator, GeneratedContent } from './BaseGenerator'
import type { ChunkCoord } from '../ChunkCoord'
import { CHUNK_SIZE } from '../ChunkManager'
import { MAT_GROUND, MAT_ROCK } from '@rendering/materials'

// Deterministic seeded random based on chunk coords + index
const rng = (cx: number, cz: number, i: number): number => {
    const x = Math.sin(cx * 127.1 + cz * 311.7 + i * 74.1) * 10000
    return x - Math.floor(x)
}

export class MountainGenerator implements BaseGenerator {
    generate(coord: ChunkCoord): GeneratedContent {
        const { cx, cz } = coord
        const worldX = cx * CHUNK_SIZE
        const worldZ = cz * CHUNK_SIZE
        const centerX = worldX + CHUNK_SIZE / 2
        const centerZ = worldZ + CHUNK_SIZE / 2

        const meshes: THREE.Mesh[] = []
        const bodyDescs: GeneratedContent['bodyDescs'] = []

        // Flat ground base
        const groundGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
        groundGeo.rotateX(-Math.PI / 2)
        const ground = new THREE.Mesh(groundGeo, MAT_GROUND)
        ground.position.set(centerX, 0, centerZ)
        ground.receiveShadow = true
        meshes.push(ground)

        const groundBody = RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, 0, centerZ)
        const groundCollider = RAPIER.ColliderDesc.cuboid(CHUNK_SIZE / 2, 0.05, CHUNK_SIZE / 2)
        bodyDescs.push({ body: groundBody, collider: groundCollider })

        // Rock formations — 4 to 8 per chunk
        const count = 4 + Math.floor(rng(cx, cz, 0) * 5)
        for (let i = 0; i < count; i++) {
            const seed = i * 10
            const lx = rng(cx, cz, seed + 1) * (CHUNK_SIZE - 8) + 4
            const lz = rng(cx, cz, seed + 2) * (CHUNK_SIZE - 8) + 4
            const w  = 3 + rng(cx, cz, seed + 3) * 7   // 3–10 units wide
            const d  = 3 + rng(cx, cz, seed + 4) * 7   // 3–10 units deep
            const h  = 6 + rng(cx, cz, seed + 5) * 19  // 6–25 units tall
            const ry = rng(cx, cz, seed + 6) * Math.PI  // random Y rotation

            const geo = new THREE.BoxGeometry(w, h, d)
            const mesh = new THREE.Mesh(geo, MAT_ROCK)
            mesh.position.set(worldX + lx, h / 2, worldZ + lz)
            mesh.rotation.y = ry
            mesh.castShadow = true
            mesh.receiveShadow = true
            meshes.push(mesh)

            // Box collider — half-extents
            const body = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(worldX + lx, h / 2, worldZ + lz)
                .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) })
            const collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
            bodyDescs.push({ body, collider })
        }

        return { meshes, bodyDescs, disposableMaterials: [] }
    }
}
