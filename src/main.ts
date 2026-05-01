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
import { AmbientMusic } from '@audio/AmbientMusic'
import { AtmosphericParticles } from '@rendering/AtmosphericParticles'
import { WeaponSystem } from '@weapons/WeaponSystem'
import { RIFLE } from '@weapons/WeaponDefinitions'
import { EnemyManager } from '@enemies/EnemyManager'

async function main(): Promise<void> {
    // 1. Rapier WASM must initialise before anything else
    await RAPIER.init()

    // 2. Core systems — initialise in parallel with the session screen
    const mapLoadPromise    = MapParser.load('/map.png')
    const usernamePromise   = showSessionScreen()

    const physics      = new PhysicsWorld()
    const sceneManager = new SceneManager()
    const cameraRig    = new CameraRig(sceneManager)
    // Camera must be in the scene so children (weapon view model) are included in render traversal
    sceneManager.scene.add(cameraRig.camera)
    sceneManager.initPostProcessing(cameraRig.camera)

    // 3. Wait for map and username entry concurrently
    const [mapParser, username] = await Promise.all([mapLoadPromise, usernamePromise])

    new AmbientMusic().start()

    // 4. Player entity (map must be loaded first)
    const player = new PlayerEntity(physics, mapParser)

    // 5. Input — init after session screen so its click listener doesn't conflict
    const input = new InputManager().init()

    // 6. Game state + HUD
    const playerState = new PlayerState(username, player.startPosition)
    const hud         = new HUD()
    hud.update(playerState.hp, playerState.maxHp)

    // 7. Player controller wired to state + HUD
    const controller = new PlayerController(input, player, cameraRig, playerState, () => hud.flashDeath())

    // 8. Weapon system — registered before controller so it reads mouse state
    //    before controller's flushJustPressed() clears it
    const weaponSystem = new WeaponSystem(RIFLE, cameraRig, sceneManager.scene, input, hud, (delta) => controller.addRecoilPitch(delta))

    // 9. Enemy manager — reads weaponSystem.lastHit; must exist before ChunkManager so it can
    //    receive spawn calls when Encounter chunks first load
    const enemyManager = new EnemyManager(sceneManager.scene, mapParser, weaponSystem, playerState, physics)

    // 10. Chunk manager — requires enemyManager for Encounter zone enemy spawning
    const chunkManager = new ChunkManager(mapParser, sceneManager.scene, physics, enemyManager)

    // 11. Force-load initial chunks so the player lands on terrain immediately
    chunkManager.update(player.startPosition)

    // 12. Game loop — chunk streaming first so terrain colliders exist
    //     before physics steps and before the KCC queries them for movement
    const loop = new GameLoop()
    loop.register({
        update: () => chunkManager.update(player.position),
    })
    loop.register(physics)
    loop.register(weaponSystem)
    // EnemyManager reads lastHit (set by weaponSystem) and ticks AI — must run after weapon, before controller
    loop.register({
        update: (dt) => enemyManager.update(dt, player.position),
    })
    loop.register(controller)
    loop.register(new AtmosphericParticles(sceneManager.scene, cameraRig.camera))
    loop.register({
        update: (dt) => {
            hud.update(playerState.hp, playerState.maxHp)
            sceneManager.render(cameraRig.camera, dt)
        },
    })

    loop.start()

    console.log(`[main] Session started. Welcome, ${username}.`)
}

main().catch(console.error)
