import * as THREE from 'three'
import type { WeaponDef } from './WeaponDefinitions'
import { WeaponViewModel, BARREL_TIP_LOCAL } from './WeaponViewModel'
import type { InputManager } from '@player/InputManager'
import type { HUD } from '@ui/HUD'

export class WeaponSystem {
    private readonly viewModel: WeaponViewModel
    private readonly raycaster = new THREE.Raycaster()

    private ammoInMag: number
    private isReloading = false
    private reloadTimer = 0
    private fireCooldown = 0
    private isScoped = false

    constructor(
        private readonly def: WeaponDef,
        private readonly camera: THREE.PerspectiveCamera,
        private readonly scene: THREE.Scene,
        private readonly input: InputManager,
        private readonly hud: HUD,
    ) {
        this.ammoInMag = def.magazineSize
        this.viewModel = new WeaponViewModel(camera)
        hud.setAmmo(this.ammoInMag, def.magazineSize)
    }

    update(dt: number): void {
        this.fireCooldown = Math.max(0, this.fireCooldown - dt)

        if (this.isReloading) {
            this.reloadTimer -= dt
            if (this.reloadTimer <= 0) {
                this.ammoInMag = this.def.magazineSize
                this.isReloading = false
                this.hud.setReloading(false)
                this.hud.setAmmo(this.ammoInMag, this.def.magazineSize)
            }
        }

        this.viewModel.update(dt)

        if (!this.input.isPointerLocked) return

        // Scope — right mouse button held
        const wantsScope = this.input.isMouseDown(2)
        if (wantsScope !== this.isScoped) {
            this.isScoped = wantsScope
            this.camera.fov = wantsScope ? this.def.scopeFov : this.def.defaultFov
            this.camera.updateProjectionMatrix()
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

        this.hud.setAmmo(this.ammoInMag, this.def.magazineSize)
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
        ).normalize().applyEuler(this.camera.rotation)

        this.raycaster.set(this.camera.position, dir)
        this.raycaster.far = this.def.range

        const hits = this.raycaster.intersectObjects(this.scene.children, true)
        if (hits.length > 0 && hits[0]) {
            this.spawnHitSpark(hits[0].point)
        }

        this.spawnMuzzleFlash()
        this.hud.setAmmo(this.ammoInMag, this.def.magazineSize)
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
        setTimeout(() => {
            this.scene.remove(mesh)
            mesh.geometry.dispose()
            mat.dispose()
        }, 150)
    }

    private spawnMuzzleFlash(): void {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 6,
            depthTest: false,
            depthWrite: false,
        })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), mat)
        mesh.renderOrder = 999
        mesh.position.copy(BARREL_TIP_LOCAL)
        this.viewModel.group.add(mesh)
        setTimeout(() => {
            this.viewModel.group.remove(mesh)
            mesh.geometry.dispose()
            mat.dispose()
        }, 80)
    }
}
