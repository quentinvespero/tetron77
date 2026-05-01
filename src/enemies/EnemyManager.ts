import * as THREE from 'three'
import { sampleBlended } from '@world/TerrainSampler'
import { rng } from '@world/generators/generatorUtils'
import { CHUNK_SIZE } from '@world/constants'
import type { MapParser } from '@world/MapParser'
import type { PhysicsWorld } from '@physics/PhysicsWorld'
import type { PlayerState } from '@player/PlayerState'
import type { WeaponSystem } from '@weapons/WeaponSystem'
import type { Chunk } from '@world/Chunk'
import type { ChunkCoord } from '@world/ChunkCoord'
import { EnemyEntity } from './EnemyEntity'

export class EnemyManager {
    private readonly activeEnemies = new Set<EnemyEntity>()

    constructor(
        private readonly scene: THREE.Scene,
        private readonly mapParser: MapParser,
        private readonly weaponSystem: WeaponSystem,
        private readonly playerState: PlayerState,
        private readonly physics: PhysicsWorld,
    ) {}

    spawnForChunk(coord: ChunkCoord): EnemyEntity[] {
        const { cx, cz } = coord
        const worldX = cx * CHUNK_SIZE
        const worldZ = cz * CHUNK_SIZE
        const count  = 2 + Math.floor(rng(cx, cz, 999) * 3)  // 2–4 per chunk

        const minX = worldX + 3
        const maxX = worldX + CHUNK_SIZE - 3
        const minZ = worldZ + 3
        const maxZ = worldZ + CHUNK_SIZE - 3
        const PATROL_RADIUS = 6

        const enemies: EnemyEntity[] = []
        for (let i = 0; i < count; i++) {
            const s = i * 37 + 1000

            const lx = 3 + rng(cx, cz, s + 1) * (CHUNK_SIZE - 6)
            const lz = 3 + rng(cx, cz, s + 2) * (CHUNK_SIZE - 6)
            const wx = worldX + lx
            const wz = worldZ + lz
            const wy = sampleBlended(wx, wz, this.mapParser)

            const yaw = rng(cx, cz, s + 3) * Math.PI * 2

            // Patrol waypoints — two per enemy, clamped within chunk bounds
            const a0   = rng(cx, cz, s + 4) * Math.PI * 2
            const a1   = rng(cx, cz, s + 5) * Math.PI * 2
            const wp0x = Math.max(minX, Math.min(maxX, wx + Math.cos(a0) * PATROL_RADIUS))
            const wp0z = Math.max(minZ, Math.min(maxZ, wz + Math.sin(a0) * PATROL_RADIUS))
            const wp1x = Math.max(minX, Math.min(maxX, wx + Math.cos(a1) * PATROL_RADIUS))
            const wp1z = Math.max(minZ, Math.min(maxZ, wz + Math.sin(a1) * PATROL_RADIUS))

            // Stagger LoS check timing — spread initial offset across a full interval
            // so each enemy's cycle stays independent after the first check
            const losOffset = rng(cx, cz, s + 6) * (0.1 * count)

            const enemy = new EnemyEntity(
                wx, wy, wz, yaw,
                wp0x, wp0z, wp1x, wp1z,
                losOffset,
                this.mapParser,
                this.physics,
                this.scene,
            )
            enemies.push(enemy)
            this.activeEnemies.add(enemy)
        }
        return enemies
    }

    despawnForChunk(chunk: Chunk): void {
        for (const enemy of chunk.getEnemies()) {
            this.activeEnemies.delete(enemy)
        }
        // Drop stale refs so chunk.dispose() skips already-dead enemies
        chunk.purgeDeadEnemies()
    }

    update(dt: number, playerPos: THREE.Vector3): void {
        // Check weapon hit against all active enemies
        const hit = this.weaponSystem.lastHit
        if (hit !== null) {
            for (const enemy of this.activeEnemies) {
                if (enemy.ownsObject(hit.object)) {
                    enemy.takeDamage(hit.damage)
                    break
                }
            }
        }

        // Tick all enemies; collect fully-dead ones for removal
        const toRemove: EnemyEntity[] = []
        for (const enemy of this.activeEnemies) {
            enemy.update(dt, playerPos, this.playerState, this.scene)
            if (enemy.isFullyDead) toRemove.push(enemy)
        }

        for (const e of toRemove) this.activeEnemies.delete(e)
    }
}
