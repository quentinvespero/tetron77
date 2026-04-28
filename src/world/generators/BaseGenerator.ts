import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ChunkCoord } from '../ChunkCoord'

export interface GeneratedContent {
    meshes:             THREE.Mesh[]
    bodyDescs:          Array<{ body: RAPIER.RigidBodyDesc, collider: RAPIER.ColliderDesc }>
    // Materials the generator created exclusively for this chunk — disposed on unload.
    // Shared/singleton materials (e.g. MAT_GROUND) must NOT be listed here.
    disposableMaterials: THREE.Material[]
}

export interface BaseGenerator {
    generate(coord: ChunkCoord): GeneratedContent
}
