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

        // Hemisphere light: cold overcast sky fill — no harsh directionality
        const hemi = new THREE.HemisphereLight(
            0x8899aa, // sky: cold desaturated blue-gray, not pure white
            0x111111, // ground bounce: very dark
            1.2       // needs to be high — base materials are very dark (0x222222)
        )
        this.scene.add(hemi)

        // Directional sun: angled from above-left, casts shadows
        const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.5)
        sun.position.set(50, 80, 30)
        sun.castShadow = true
        sun.shadow.camera.near = 0.5
        sun.shadow.camera.far = 400
        sun.shadow.camera.left = -100
        sun.shadow.camera.right = 100
        sun.shadow.camera.top = 100
        sun.shadow.camera.bottom = -100
        sun.shadow.mapSize.set(2048, 2048)
        // Slight bias prevents shadow acne on flat terrain surfaces
        sun.shadow.bias = -0.001
        this.scene.add(sun)

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
