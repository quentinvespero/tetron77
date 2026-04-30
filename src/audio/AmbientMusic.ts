export class AmbientMusic {
    private audio: HTMLAudioElement

    constructor() {
        this.audio = new Audio('/ambient_music.opus')
        this.audio.loop = true
        this.audio.volume = 0
    }

    // Call after a user gesture — fades volume from 0 to targetVolume over fadeDurationMs
    start(targetVolume = 0.8, fadeDurationMs = 5000) {
        this.audio.play().catch(console.warn)

        const startTime = performance.now()
        const tick = () => {
            const elapsed = performance.now() - startTime
            const t = Math.min(elapsed / fadeDurationMs, 1)
            this.audio.volume = t * targetVolume
            if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }
}
