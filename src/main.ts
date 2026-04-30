import RAPIER from '@dimforge/rapier3d-compat'
import { GameLoop } from '@core/GameLoop'
import { SceneManager } from '@rendering/SceneManager'
import { CameraRig } from '@rendering/CameraRig'
import { PhysicsWorld } from '@physics/PhysicsWorld'
import { InputManager } from '@player/InputManager'
import { PlayerEntity } from '@player/PlayerEntity'
import { PlayerController } from '@player/PlayerController'
import { PlayerState } from '@player/PlayerState'
import { MapParser } from '@world/MapParser'
import { ChunkManager } from '@world/ChunkManager'
import { showSessionScreen } from '@ui/SessionScreen'
import { HUD } from '@ui/HUD'

async function main(): Promise<void> {
    // 1. Rapier WASM must initialise before anything else
    await RAPIER.init()

    // 2. Core systems — initialise in parallel with the session screen
    const mapLoadPromise    = MapParser.load('/map.png')
    const usernamePromise   = showSessionScreen()

    const physics      = new PhysicsWorld()
    const sceneManager = new SceneManager()
    const cameraRig    = new CameraRig(sceneManager)
    sceneManager.initPostProcessing(cameraRig.camera)

    // 3. Wait for map and username entry concurrently
    const [mapParser, username] = await Promise.all([mapLoadPromise, usernamePromise])

    // 4. Chunk manager + player (map must be loaded first)
    const chunkManager = new ChunkManager(mapParser, sceneManager.scene, physics)
    const player       = new PlayerEntity(physics)

    // 5. Force-load initial chunks so the player lands on terrain immediately
    chunkManager.update(player.startPosition)

    // 6. Input — init after session screen so its click listener doesn't conflict
    const input = new InputManager().init()

    // 7. Game state + HUD
    const playerState = new PlayerState(username, player.startPosition)
    const hud         = new HUD()
    hud.update(playerState.hp, playerState.maxHp)

    // 8. Player controller wired to state + HUD
    const controller = new PlayerController(input, player, cameraRig, physics, playerState, () => hud.flashDeath())

    // 9. Game loop — registration order: physics → controller → chunks → hud + render
    const loop = new GameLoop()
    loop.register(physics)
    loop.register(controller)
    loop.register({
        update: () => chunkManager.update(player.position),
    })
    loop.register({
        update: (dt: number) => {
            hud.update(playerState.hp, playerState.maxHp)
            sceneManager.render(cameraRig.camera, dt)
        },
    })

    loop.start()

    console.log(`[main] Session started. Welcome, ${username}.`)
}

main().catch(console.error)
