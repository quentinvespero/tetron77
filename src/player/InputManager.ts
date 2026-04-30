export class InputManager {
    keys: Record<string, boolean> = {}
    private justPressed: Record<string, boolean> = {}
    mouseDeltaX = 0
    mouseDeltaY = 0
    isPointerLocked = false

    init(): this {
        // Sync with pointer lock that may have been granted before this init
        this.isPointerLocked = document.pointerLockElement !== null

        document.addEventListener('keydown', (e) => {
            // Only flag as just-pressed on the leading edge (key was up)
            if (!this.keys[e.code]) this.justPressed[e.code] = true
            this.keys[e.code] = true
        })
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false
        })
        document.addEventListener('mousemove', (e) => {
            if (!this.isPointerLocked) return
            this.mouseDeltaX += e.movementX
            this.mouseDeltaY += e.movementY
        })
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement !== null
            const hint = document.getElementById('click-to-play')
            if (hint) hint.classList.toggle('hidden', this.isPointerLocked)
        })
        // Click anywhere on the canvas to acquire pointer lock
        document.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                document.body.requestPointerLock()
            }
        })

        return this
    }

    /** Returns accumulated mouse delta since last call, then resets it. */
    consumeMouseDelta(): { dx: number, dy: number } {
        const dx = this.mouseDeltaX
        const dy = this.mouseDeltaY
        this.mouseDeltaX = 0
        this.mouseDeltaY = 0
        return { dx, dy }
    }

    isDown(code: string): boolean {
        return this.keys[code] === true
    }

    /** True only on the first frame a key transitions from up to down. */
    isJustPressed(code: string): boolean {
        return this.justPressed[code] === true
    }

    /** Must be called once per frame after all input consumers have run. */
    flushJustPressed(): void {
        this.justPressed = {}
    }
}
