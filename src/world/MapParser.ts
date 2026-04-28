import { ZoneType, COLOR_TO_ZONE, FALLBACK_ZONE } from './ZoneType'

// 1 pixel = 1 chunk = CHUNK_SIZE world units (must match ChunkManager constant)
export const MAP_CHUNK_SCALE = 32

export class MapParser {
    private pixels: Uint8ClampedArray
    readonly width: number
    readonly height: number

    private constructor(pixels: Uint8ClampedArray, width: number, height: number) {
        this.pixels = pixels
        this.width  = width
        this.height = height
    }

    static async load(url: string): Promise<MapParser> {
        // Fetch the PNG and decode via Canvas 2D API
        const blob = await fetch(url).then(r => r.blob())
        const img  = await createImageBitmap(blob)

        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx    = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        const { data } = ctx.getImageData(0, 0, img.width, img.height)
        return new MapParser(data, img.width, img.height)
    }

    /**
     * Returns the zone type at the given world-space coordinates.
     * Out-of-bounds coordinates clamp to the map edge.
     */
    getZoneAt(worldX: number, worldZ: number): ZoneType {
        const px = Math.floor(worldX / MAP_CHUNK_SCALE)
        const pz = Math.floor(worldZ / MAP_CHUNK_SCALE)
        return this.getPixelAt(px, pz)
    }

    /**
     * Direct pixel lookup. Clamps out-of-range values.
     */
    getPixelAt(px: number, pz: number): ZoneType {
        const x = Math.max(0, Math.min(this.width  - 1, px))
        const z = Math.max(0, Math.min(this.height - 1, pz))

        const idx = (z * this.width + x) * 4
        const r   = this.pixels[idx]!
        const g   = this.pixels[idx + 1]!
        const b   = this.pixels[idx + 2]!

        const key  = (r << 16) | (g << 8) | b
        return COLOR_TO_ZONE.get(key) ?? FALLBACK_ZONE
    }
}
