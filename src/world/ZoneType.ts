// Zone type enum — mirrors the PNG color palette in CLAUDE.md
export enum ZoneType {
    Mountains = 'Mountains',
    Water     = 'Water',
    CityRuins = 'CityRuins',
    Encounter = 'Encounter',
    POI       = 'POI',
    Plains    = 'Plains',
}

// Pack RGB into a single integer for O(1) lookup — alpha ignored
const pack = (r: number, g: number, b: number): number =>
    (r << 16) | (g << 8) | b

// Color → zone mapping — single source of truth
export const COLOR_TO_ZONE = new Map<number, ZoneType>([
    [pack(0,   0,   0  ), ZoneType.Mountains],
    [pack(0,   0,   255), ZoneType.Water],
    [pack(136, 136, 136), ZoneType.CityRuins],
    [pack(255, 0,   0  ), ZoneType.Encounter],
    [pack(255, 255, 0  ), ZoneType.POI],
    [pack(255, 255, 255), ZoneType.Plains],
])

export const FALLBACK_ZONE = ZoneType.Plains
