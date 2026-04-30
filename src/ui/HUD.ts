import { getEl } from './dom'

export class HUD {
    private readonly container:    HTMLElement
    private readonly healthFill:   HTMLElement
    private readonly deathFlash:   HTMLElement
    private readonly ammoBullets:  HTMLElement
    private readonly ammoReload:   HTMLElement
    private readonly crosshair:    HTMLElement
    private readonly scopeOverlay: HTMLElement
    private _lastPct = -1
    private _lastAmmo = -1

    constructor() {
        this.container    = getEl('hud')
        this.healthFill   = getEl('health-fill')
        this.deathFlash   = getEl('death-flash')
        this.ammoBullets  = getEl('ammo-bullets')
        this.ammoReload   = getEl('ammo-reload')
        this.crosshair    = getEl('crosshair')
        this.scopeOverlay = getEl('scope-overlay')

        // Sync with pointer lock that may have been granted before this constructor ran
        this.container.classList.toggle('visible', document.pointerLockElement !== null)
        document.addEventListener('pointerlockchange', () => {
            this.container.classList.toggle('visible', document.pointerLockElement !== null)
        })
    }

    update(hp: number, maxHp: number): void {
        const pct = Math.max(0, hp / maxHp) * 100
        if (pct === this._lastPct) return
        this._lastPct = pct
        this.healthFill.style.width = `${pct}%`
    }

    setAmmo(current: number, max: number): void {
        if (current === this._lastAmmo) return
        this._lastAmmo = current
        this.ammoBullets.textContent = `${current} / ∞`
    }

    setReloading(active: boolean): void {
        this.ammoBullets.classList.toggle('hidden', active)
        this.ammoReload.classList.toggle('hidden', !active)
    }

    setScoped(active: boolean): void {
        this.scopeOverlay.classList.toggle('active', active)
        this.crosshair.classList.toggle('scoped', active)
    }

    flashDeath(): void {
        // Remove then re-add to retrigger the animation if called multiple times
        this.deathFlash.classList.remove('active')
        void this.deathFlash.offsetWidth
        this.deathFlash.classList.add('active')
    }
}
