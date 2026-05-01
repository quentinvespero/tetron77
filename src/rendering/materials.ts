import * as THREE from 'three'

// B&W palette — shared across all generators and entities
export const PALETTE = {
    ground:     0x3a3a3a,
    groundAlt:  0x484848,
    rock:       0x2e2e2e,
    ruin:       0x444444,
    water:      0x151515,
    fog:        0x0a0a0a,
    ambient:    0xffffff,
    sunlight:   0xaac4d8, // pale cold blue-silver — moonlight, not sunlight
    skyHorizon: 0x0a0a0a, // matches fog — seamless blend at the horizon line
    skyZenith:  0x3a6090, // dark navy — visible night sky
} as const

// Terrain material with vertex colors enabled — each chunk applies its own height gradient
export const MAT_GROUND_VC = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
})

export const MAT_ROCK = new THREE.MeshStandardMaterial({
    color: PALETTE.rock,
    roughness: 0.75,  // slight specular catch-lights on edges
    metalness: 0.0,
})

// Slightly lighter than ground for ruined concrete/debris
export const MAT_RUIN = new THREE.MeshStandardMaterial({
    color: PALETTE.ruin,
    roughness: 0.75,  // slight specular catch-lights on edges
    metalness: 0.0,
})

// Still black water — low roughness gives faint reflective sheen
export const MAT_WATER = new THREE.MeshStandardMaterial({
    color: PALETTE.water,
    roughness: 0.2,
    metalness: 0.1,
})

// Colors used for height-based terrain gradient
const TERRAIN_LOW  = new THREE.Color(0x2a2a2a)  // dark at base elevation
const TERRAIN_HIGH = new THREE.Color(0x555560)  // cool gray-blue at peaks

// Absolute world-space Y range — must match TerrainSampler ZONE_CONFIG:
//   WORLD_Y_MIN = Water baseY (-2), WORLD_Y_MAX = Mountains baseY + amplitude (2 + 32 = 34)
const WORLD_Y_MIN = -2
const WORLD_Y_MAX = 34

// Applies height-based vertex colors using world-space Y bounds so the gradient is consistent across all chunks
export const applyTerrainVertexColors = (geo: THREE.BufferGeometry): void => {
    const pos   = geo.attributes.position as THREE.BufferAttribute
    const count = pos.count
    const range = Math.max(WORLD_Y_MAX - WORLD_Y_MIN, 0.1)
    const buf   = new Float32Array(count * 3)
    const tmp   = new THREE.Color()

    for (let i = 0; i < count; i++) {
        // Power curve biases gradient so lighter tones appear at upper surfaces
        const t = Math.pow((pos.getY(i) - WORLD_Y_MIN) / range, 0.6)
        tmp.copy(TERRAIN_LOW).lerp(TERRAIN_HIGH, t)
        buf[i * 3]     = tmp.r
        buf[i * 3 + 1] = tmp.g
        buf[i * 3 + 2] = tmp.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(buf, 3))
}
