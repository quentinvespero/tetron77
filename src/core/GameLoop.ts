export interface Updatable {
    update(dt: number): void
}

export class GameLoop {
    private systems: Updatable[] = []
    private rafId: number | null = null
    private lastTime: number | null = null

    // Max dt cap prevents huge physics steps after tab was backgrounded
    private readonly MAX_DT = 0.1

    register(system: Updatable): void {
        this.systems.push(system)
    }

    start(): void {
        if (this.rafId !== null) return
        this.rafId = requestAnimationFrame(this.tick)
    }

    stop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
            this.lastTime = null
        }
    }

    private tick = (now: number): void => {
        this.rafId = requestAnimationFrame(this.tick)

        if (this.lastTime === null) {
            this.lastTime = now
            return
        }

        const dt = Math.min((now - this.lastTime) / 1000, this.MAX_DT)
        this.lastTime = now

        for (const system of this.systems) {
            system.update(dt)
        }
    }
}
