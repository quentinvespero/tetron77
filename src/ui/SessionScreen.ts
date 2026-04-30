import { getEl } from './dom'

/** Fades out the session screen and resolves with the entered username. */
export const showSessionScreen = (): Promise<string> => {
    const overlay = getEl('session-screen')
    const input   = getEl('username-input') as HTMLInputElement
    const button  = getEl('enter-world-btn')

    input.focus()

    return new Promise(resolve => {
        let started = false

        const start = () => {
            if (started) return
            started = true

            const username = input.value.trim() || 'UNKNOWN'
            overlay.style.opacity = '0'
            overlay.style.pointerEvents = 'none'
            // Remove from DOM only after the CSS opacity transition ends
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
            // Request pointer lock now while we're still inside the user gesture
            document.body.requestPointerLock()
            resolve(username)
        }

        button.addEventListener('click', start)
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') start()
        })
    })
}
