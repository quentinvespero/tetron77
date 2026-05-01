import * as THREE from 'three'

// Injects world-space hash noise into a MeshStandardMaterial's fragment output.
// Creates a stable per-surface grain (not screen-space, so it doesn't crawl with the camera).
export const applyGrainShader = (mat: THREE.MeshStandardMaterial, strength = 0.055, scale = 11.0): void => {
    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'varying vec3 vGrainPos;\nvoid main() {')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vGrainPos = (modelMatrix * vec4(position, 1.0)).xyz;`
            )

        shader.fragmentShader = shader.fragmentShader
            .replace(
                'void main() {',
                `varying vec3 vGrainPos;
                float grainHash(vec3 p) {
                    p = fract(p * vec3(443.897, 441.423, 437.195));
                    p += dot(p, p.yzx + 19.19);
                    return fract((p.x + p.y) * p.z);
                }
                void main() {`
            )
            .replace(
                '#include <output_fragment>',
                `#include <output_fragment>
                // Two octaves: coarse grain + fine detail layer
                float grain = grainHash(floor(vGrainPos * ${scale.toFixed(1)})) * 0.6
                            + grainHash(floor(vGrainPos * ${(scale * 2.3).toFixed(1)})) * 0.4;
                gl_FragColor.rgb += (grain - 0.5) * ${strength.toFixed(3)};`
            )
    }
    mat.needsUpdate = true
}

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
applyGrainShader(MAT_GROUND_VC, 0.20, 6.0)

export const MAT_ROCK = new THREE.MeshStandardMaterial({
    color: PALETTE.rock,
    roughness: 0.75,  // slight specular catch-lights on edges
    metalness: 0.0,
})
applyGrainShader(MAT_ROCK, 0.32, 10.0)

// Slightly lighter than ground for ruined concrete/debris
export const MAT_RUIN = new THREE.MeshStandardMaterial({
    color: PALETTE.ruin,
    roughness: 0.75,  // slight specular catch-lights on edges
    metalness: 0.0,
})
applyGrainShader(MAT_RUIN, 0.28, 8.0)

// Dark navy water — slight transparency reduces Z-fight shimmer at terrain boundaries;
// emissive prevents it going fully black in shadow
export const MAT_WATER = new THREE.MeshStandardMaterial({
    color:             0x0a1828,
    roughness:         0.15,
    metalness:         0.0,
    transparent:       true,
    opacity:           0.88,
    emissive:          new THREE.Color(0x040c14),
    emissiveIntensity: 0.4,
    side:              THREE.FrontSide,
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
