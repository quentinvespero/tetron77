import * as THREE from 'three'
import type { WeaponDef } from './WeaponDefinitions'
import { WeaponViewModel, BARREL_TIP_LOCAL } from './WeaponViewModel'
import type { CameraRig } from '@rendering/CameraRig'
import type { InputManager } from '@player/InputManager'
import type { HUD } from '@ui/HUD'

interface Effect {
    ttl: number
    remove: () => void
}

export class WeaponSystem {
    private readonly viewModel: WeaponViewModel
    private readonly raycaster = new THREE.Raycaster()
    private readonly effects: Effect[] = []

    private ammoInMag: number
    private isReloading = false
    private reloadTimer = 0
    private fireCooldown = 0
    private isScoped = false
    private readonly prevCameraQuat = new THREE.Quaternion()

    constructor(
        private readonly def: WeaponDef,
        private readonly cameraRig: CameraRig,
        private readonly scene: THREE.Scene,
        private readonly input: InputManager,
        private readonly hud: HUD,
    ) {
        this.ammoInMag = def.magazineSize
        this.viewModel = new WeaponViewModel(cameraRig.camera)
        hud.setAmmo(this.ammoInMag)
    }

    update(dt: number): void {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt)

        // Tick down and clean up transient visual effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i]!.ttl -= dt
            if (this.effects[i]!.ttl <= 0) {
                this.effects[i]!.remove()
                this.effects.splice(i, 1)
            }
        }

        if (this.isReloading) {
            this.reloadTimer -= dt
            if (this.reloadTimer <= 0) {
                this.ammoInMag = this.def.magazineSize
                this.isReloading = false
                this.hud.setReloading(false)
                this.hud.setAmmo(this.ammoInMag)
            }
        }

        const curQuat = this.cameraRig.camera.getWorldQuaternion(new THREE.Quaternion())
        const deltaQuat = this.prevCameraQuat.clone().invert().multiply(curQuat)
        const deltaEuler = new THREE.Euler().setFromQuaternion(deltaQuat, 'YXZ')
        this.prevCameraQuat.copy(curQuat)

        this.viewModel.update(dt, deltaEuler.y, deltaEuler.x)

        if (!this.input.isPointerLocked) return

        // Scope — right mouse button held
        const wantsScope = this.input.isMouseDown(2)
        if (wantsScope !== this.isScoped) {
            this.isScoped = wantsScope
            this.cameraRig.setFov(wantsScope ? this.def.scopeFov : this.def.defaultFov)
            this.hud.setScoped(wantsScope)
        }

        // Manual reload (R)
        if (this.input.isJustPressed('KeyR') && !this.isReloading && this.ammoInMag < this.def.magazineSize) {
            this.startReload()
        }

        // Fire (left click)
        if (this.input.isMouseJustPressed(0) && !this.isReloading) {
            this.tryFire()
        }

        // Auto-reload on empty mag
        if (this.ammoInMag === 0 && !this.isReloading) {
            this.startReload()
        }
    }

    private tryFire(): void {
        if (this.fireCooldown > 0 || this.ammoInMag === 0) return

        this.ammoInMag--
        this.fireCooldown = 1 / this.def.fireRate

        // Build ray: slight random spread in camera space, then rotate to world space
        const spread = this.isScoped ? this.def.spread * 0.2 : this.def.spread
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            -1,
        ).normalize().applyEuler(this.cameraRig.camera.rotation)

        this.raycaster.set(this.cameraRig.camera.position, dir)
        this.raycaster.far = this.def.range

        const hits = this.raycaster.intersectObjects(this.scene.children, true)
        if (hits.length > 0 && hits[0]) {
            this.spawnHitSpark(hits[0].point)
        }

        this.spawnMuzzleFlash()
        this.hud.setAmmo(this.ammoInMag)
    }

    private startReload(): void {
        this.isReloading = true
        this.reloadTimer = this.def.reloadTime
        this.hud.setReloading(true)
    }

    private spawnHitSpark(position: THREE.Vector3): void {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 4,
        })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), mat)
        mesh.position.copy(position)
        this.scene.add(mesh)
        this.effects.push({
            ttl: 0.15,
            remove: () => {
                this.scene.remove(mesh)
                mesh.geometry.dispose()
                mat.dispose()
            },
        })
    }

    private spawnMuzzleFlash(): void {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff4400,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
            depthWrite: false,
        })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), mat)
        mesh.renderOrder = 999
        mesh.position.copy(BARREL_TIP_LOCAL)
        this.viewModel.group.add(mesh)
        this.effects.push({
            ttl: 0.04,
            remove: () => {
                this.viewModel.group.remove(mesh)
                mesh.geometry.dispose()
                mat.dispose()
            },
        })
    }
}
