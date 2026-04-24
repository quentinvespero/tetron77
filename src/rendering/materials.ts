import * as THREE from 'three'

// B&W palette — shared across all generators and entities
export const PALETTE = {
    ground:    0x222222,
    groundAlt: 0x2e2e2e,
    rock:      0x1a1a1a,
    ruin:      0x2a2a2a,
    water:     0x0d0d0d,
    fog:       0x0a0a0a,
    ambient:   0xffffff,
    sunlight:  0xe0e0e0,
} as const

// Shared materials — avoids creating duplicate material objects per mesh
export const MAT_GROUND = new THREE.MeshStandardMaterial({
    color: PALETTE.ground,
    roughness: 1.0,
    metalness: 0.0,
})

export const MAT_ROCK = new THREE.MeshStandardMaterial({
    color: PALETTE.rock,
    roughness: 1.0,
    metalness: 0.0,
})

// Slightly lighter than ground for ruined concrete/debris
export const MAT_RUIN = new THREE.MeshStandardMaterial({
    color: PALETTE.ruin,
    roughness: 1.0,
    metalness: 0.0,
})

// Still black water — low roughness gives faint reflective sheen
export const MAT_WATER = new THREE.MeshStandardMaterial({
    color: PALETTE.water,
    roughness: 0.2,
    metalness: 0.1,
})
