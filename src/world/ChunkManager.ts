import * as THREE from 'three'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import type { MapParser } from './MapParser'
import { Chunk } from './Chunk'
import { chunkKey, type ChunkCoord } from './ChunkCoord'
import { ZoneType } from './ZoneType'
import { PlainGenerator } from './generators/PlainGenerator'
import { MountainGenerator } from './generators/MountainGenerator'
import { WaterGenerator } from './generators/WaterGenerator'
import { CityRuinsGenerator } from './generators/CityRuinsGenerator'
import { EncounterGenerator } from './generators/EncounterGenerator'
import { POIGenerator } from './generators/POIGenerator'
import type { BaseGenerator } from './generators/BaseGenerator'

// World units per chunk side — 1 pixel in map.png = 1 chunk
export const CHUNK_SIZE    = 32
// Chunks to load around the player (Manhattan distance)
const VIEW_RADIUS   = 3
// Chunks outside this radius get unloaded (hysteresis prevents thrashing)
const UNLOAD_RADIUS = 5

export class ChunkManager {
    private loaded = new Map<string, Chunk>()
    // Generators keyed by zone type — extend as new zones are implemented
    private generators: Partial<Record<ZoneType, BaseGenerator>>

    constructor(
        private mapParser: MapParser,
        private scene: THREE.Scene,
        private physics: PhysicsWorld,
    ) {
        this.generators = {
            [ZoneType.Plains]:    new PlainGenerator(),
            [ZoneType.Mountains]: new MountainGenerator(),
            [ZoneType.Water]:     new WaterGenerator(),
            [ZoneType.CityRuins]: new CityRuinsGenerator(),
            [ZoneType.Encounter]: new EncounterGenerator(),
            [ZoneType.POI]:       new POIGenerator(),
        }
    }

    /**
     * Call each frame with the player's world position.
     * Loads missing chunks within VIEW_RADIUS; unloads chunks outside UNLOAD_RADIUS.
     */
    update(playerWorldPos: THREE.Vector3): void {
        const pcx = Math.floor(playerWorldPos.x / CHUNK_SIZE)
        const pcz = Math.floor(playerWorldPos.z / CHUNK_SIZE)

        // Determine which chunks should be loaded
        for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
            for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
                const coord: ChunkCoord = { cx: pcx + dx, cz: pcz + dz }
                if (!this.loaded.has(chunkKey(coord))) {
                    this.loadChunk(coord)
                }
            }
        }

        // Unload chunks outside UNLOAD_RADIUS
        for (const [key, chunk] of this.loaded) {
            const dx = Math.abs(chunk.coord.cx - pcx)
            const dz = Math.abs(chunk.coord.cz - pcz)
            if (dx > UNLOAD_RADIUS || dz > UNLOAD_RADIUS) {
                this.unloadChunk(key, chunk)
            }
        }
    }

    private loadChunk(coord: ChunkCoord): void {
        const key       = chunkKey(coord)
        const zoneType  = this.mapParser.getZoneAt(coord.cx * CHUNK_SIZE, coord.cz * CHUNK_SIZE)
        const generator = this.generators[zoneType] ?? new PlainGenerator()

        const chunk = new Chunk(coord)
        chunk.build(this.scene, this.physics, generator)
        this.loaded.set(key, chunk)
    }

    private unloadChunk(key: string, chunk: Chunk): void {
        chunk.dispose(this.scene, this.physics)
        this.loaded.delete(key)
    }
}
