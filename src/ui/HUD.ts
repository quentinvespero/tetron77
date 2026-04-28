import { getEl } from './dom'

export class HUD {
    private readonly container:  HTMLElement
    private readonly healthFill: HTMLElement
    private readonly deathFlash: HTMLElement
    private _lastPct = -1

    constructor() {
        this.container  = getEl('hud')
        this.healthFill = getEl('health-fill')
        this.deathFlash = getEl('death-flash')

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

    flashDeath(): void {
        // Remove then re-add to retrigger the animation if called multiple times
        this.deathFlash.classList.remove('active')
        void this.deathFlash.offsetWidth
        this.deathFlash.classList.add('active')
    }
}
