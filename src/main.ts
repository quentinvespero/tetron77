import RAPIER from '@dimforge/rapier3d-compat'
import { GameLoop } from '@core/GameLoop'
import { SceneManager } from '@rendering/SceneManager'
import { CameraRig } from '@rendering/CameraRig'
import { PhysicsWorld } from '@physics/PhysicsWorld'
import { InputManager } from '@player/InputManager'
import { PlayerEntity } from '@player/PlayerEntity'
import { PlayerController } from '@player/PlayerController'
import { MapParser } from '@world/MapParser'
import { ChunkManager } from '@world/ChunkManager'

async function main(): Promise<void> {
    // 1. Rapier WASM must initialise before anything else
    await RAPIER.init()

    // 2. Core systems
    const physics      = new PhysicsWorld()
    const sceneManager = new SceneManager()
    const cameraRig    = new CameraRig(sceneManager)

    // 3. World map
    const mapParser    = await MapParser.load('/map.png')

    // 4. Chunk manager
    const chunkManager = new ChunkManager(mapParser, sceneManager.scene, physics)

    // 5. Player
    const input      = new InputManager().init()
    const player     = new PlayerEntity(physics)
    const controller = new PlayerController(input, player, cameraRig, physics)

    // 6. Force-load initial chunks before the loop starts so the player lands on terrain
    chunkManager.update(player.startPosition)

    // 7. Game loop — registration order matters
    //    physics → controller (reads physics) → chunks (tracks player pos) → render
    const loop = new GameLoop()
    loop.register(physics)
    loop.register(controller)
    loop.register({
        update: () => chunkManager.update(player.position),
    })
    loop.register({
        update: () => sceneManager.render(cameraRig.camera),
    })

    loop.start()

    console.log('[main] Game started. Click to play.')
}

main().catch(console.error)
