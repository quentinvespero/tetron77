export class WeaponSounds {
    private ctx: AudioContext | null = null
    private rawBuffer: ArrayBuffer | null = null
    private shotBuffer: AudioBuffer | null = null
    private decoding = false

    // Only fetches — AudioContext is created lazily on first playShot() call
    // (browsers require a user gesture before AudioContext can run)
    async load(): Promise<void> {
        const res = await fetch('/shot_gun2.opus')
        this.rawBuffer = await res.arrayBuffer()
    }

    playShot(volume = 1): void {
        if (!this.ctx) this.ctx = new AudioContext()
        if (this.ctx.state === 'suspended') this.ctx.resume()

        if (!this.shotBuffer) {
            if (!this.rawBuffer || this.decoding) return
            this.decoding = true
            this.ctx.decodeAudioData(this.rawBuffer).then(buffer => {
                this.shotBuffer = buffer
                this.rawBuffer = null
                this.decoding = false
                this._play(buffer, volume)
            }).catch(console.error)
            return
        }

        this._play(this.shotBuffer, volume)
    }

    private _play(buffer: AudioBuffer, volume: number): void {
        const source = this.ctx!.createBufferSource()
        source.buffer = buffer
        const gain = this.ctx!.createGain()
        gain.gain.value = volume
        source.connect(gain)
        gain.connect(this.ctx!.destination)
        source.start()
    }
}
