import { ZoneType } from './ZoneType'
import type { MapParser } from './MapParser'
import { CHUNK_SIZE } from './constants'

// Terrain mesh subdivision per chunk — 16×16 cells = 289 vertices, 512 triangles
export const TERRAIN_SEGS = 16

// World units over which terrain heights blend when crossing a zone boundary
const BLEND_RADIUS = 6

// --- Value noise internals ---

const smoothstep = (t: number) => t * t * (3 - 2 * t)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Pseudo-random value at integer grid point — same sin-hash approach as existing generators
const grad = (ix: number, iz: number): number => {
    const v = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
    return v - Math.floor(v)
}

// Smooth value noise — bilinear interpolation with smoothstep easing
const valueNoise = (x: number, z: number): number => {
    const ix = Math.floor(x), iz = Math.floor(z)
    const fx = smoothstep(x - ix), fz = smoothstep(z - iz)
    return lerp(
        lerp(grad(ix,     iz    ), grad(ix + 1, iz    ), fx),
        lerp(grad(ix,     iz + 1), grad(ix + 1, iz + 1), fx),
        fz
    )
}

// FBM — 4 octaves stacked at halving amplitude and doubling frequency
const fbm = (wx: number, wz: number): number => {
    let v = 0, amp = 0.5, freq = 1
    for (let i = 0; i < 4; i++) {
        v    += valueNoise(wx * freq, wz * freq) * amp
        amp  *= 0.5
        freq *= 2
    }
    return v  // ~0..1 range
}

// --- Per-zone terrain configuration ---

interface ZoneConfig {
    amplitude: number  // world-unit height range above baseY
    baseY:     number  // minimum elevation for this zone
    frequency: number  // noise cycles per world unit (lower = broader hills)
}

const ZONE_CONFIG: Record<ZoneType, ZoneConfig> = {
    [ZoneType.Plains]:    { amplitude: 6,  baseY: -1, frequency: 0.008 },
    [ZoneType.Mountains]: { amplitude: 28, baseY:  4, frequency: 0.012 },
    [ZoneType.CityRuins]: { amplitude: 3,  baseY:  0, frequency: 0.008 },
    [ZoneType.Encounter]: { amplitude: 2,  baseY:  0, frequency: 0.008 },
    [ZoneType.POI]:       { amplitude: 2,  baseY:  0, frequency: 0.006 },
    [ZoneType.Water]:     { amplitude: 0,  baseY: -2, frequency: 0     },
}

/** Returns the terrain height (world Y) at a given world XZ position for a fixed zone type. */
export const sample = (worldX: number, worldZ: number, zone: ZoneType): number => {
    const { amplitude, baseY, frequency } = ZONE_CONFIG[zone]
    if (amplitude === 0) return baseY
    return baseY + fbm(worldX * frequency, worldZ * frequency) * amplitude
}

/**
 * Like `sample`, but blends heights smoothly across zone boundaries.
 * Uses a bilinear blend across all four neighboring zone quadrants so that
 * corners where three zones meet have no visible seam.
 */
export const sampleBlended = (worldX: number, worldZ: number, mapParser: MapParser): number => {
    const zone = mapParser.getZoneAt(worldX, worldZ)
    const h    = sample(worldX, worldZ, zone)

    // Distance to nearest chunk boundary on each axis
    const modX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const modZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const dx   = Math.min(modX, CHUNK_SIZE - modX)
    const dz   = Math.min(modZ, CHUNK_SIZE - modZ)

    if (dx >= BLEND_RADIUS && dz >= BLEND_RADIUS) return h

    // Step one unit past each boundary to sample all four zone quadrants
    const crossXWorld = modX < CHUNK_SIZE / 2 ? worldX - modX - 1 : worldX + (CHUNK_SIZE - modX) + 1
    const crossZWorld = modZ < CHUNK_SIZE / 2 ? worldZ - modZ - 1 : worldZ + (CHUNK_SIZE - modZ) + 1

    const zoneX    = mapParser.getZoneAt(crossXWorld, worldZ)
    const zoneZ    = mapParser.getZoneAt(worldX, crossZWorld)
    const zoneDiag = mapParser.getZoneAt(crossXWorld, crossZWorld)

    // Per-axis weights: 0.5 at boundary → 1.0 at BLEND_RADIUS (own zone weight)
    const tx = dx < BLEND_RADIUS ? 0.5 + 0.5 * smoothstep(dx / BLEND_RADIUS) : 1
    const tz = dz < BLEND_RADIUS ? 0.5 + 0.5 * smoothstep(dz / BLEND_RADIUS) : 1

    const hX    = sample(worldX, worldZ, zoneX)
    const hZ    = sample(worldX, worldZ, zoneZ)
    const hDiag = sample(worldX, worldZ, zoneDiag)

    return h * (tx * tz) + hX * ((1 - tx) * tz) + hZ * (tx * (1 - tz)) + hDiag * ((1 - tx) * (1 - tz))
}

/**
 * Builds the height grid for a chunk in a single pass, shared between the visual mesh
 * and the Rapier heightfield collider.
 *
 * Index mapping: heights[row*(TERRAIN_SEGS+1)+col] aligns with PlaneGeometry vertex i
 * after rotateX(-π/2) — both use the same (row→Z, col→X) ordering.
 */
export const buildHeights = (centerX: number, centerZ: number, mapParser: MapParser): Float32Array => {
    const N       = TERRAIN_SEGS + 1
    const heights = new Float32Array(N * N)
    for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
            heights[row * N + col] = sampleBlended(
                centerX + (col / TERRAIN_SEGS - 0.5) * CHUNK_SIZE,
                centerZ + (row / TERRAIN_SEGS - 0.5) * CHUNK_SIZE,
                mapParser,
            )
        }
    }
    return heights
}
