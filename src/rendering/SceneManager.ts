import * as THREE from 'three'
import { PALETTE } from './materials'

export class SceneManager {
    readonly scene: THREE.Scene
    readonly renderer: THREE.WebGLRenderer

    private resizeCallbacks: Array<() => void> = []

    constructor() {
        this.scene = new THREE.Scene()

        // Exponential fog — fades into near-black at ~3 chunks distance
        this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.025)
        this.scene.background = new THREE.Color(PALETTE.fog)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        // LinearToneMapping keeps the B&W palette from being crushed by ACES
        this.renderer.toneMapping = THREE.LinearToneMapping
        this.renderer.toneMappingExposure = 1.0

        document.body.appendChild(this.renderer.domElement)

        window.addEventListener('resize', this.handleResize)
    }

    render(camera: THREE.Camera): void {
        this.renderer.render(this.scene, camera)
    }

    onResize(callback: () => void): void {
        this.resizeCallbacks.push(callback)
    }

    private handleResize = (): void => {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        for (const cb of this.resizeCallbacks) cb()
    }

}
