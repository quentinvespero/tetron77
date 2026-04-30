import * as THREE from 'three'
import { PALETTE } from './materials'
import { PostProcessor } from './PostProcessor'

export class SceneManager {
    readonly scene: THREE.Scene
    readonly renderer: THREE.WebGLRenderer

    private resizeCallbacks: Array<() => void> = []
    private skyDome!: THREE.Mesh
    private postProcessor: PostProcessor | null = null

    constructor() {
        this.scene = new THREE.Scene()

        // Exponential fog — reveals ~5 chunks before fading into darkness
        this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.016)

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
            0x556677, // sky: cooler blue-gray, moonlit overcast
            0x111111, // ground bounce: very dark
            2.2       // needs to be high — base materials are very dark (0x222222)
        )
        this.scene.add(hemi)

        // Directional sun: angled from above-left, casts shadows
        const sun = new THREE.DirectionalLight(PALETTE.sunlight, 5.5)
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

        this.buildSkyDome()

        document.body.appendChild(this.renderer.domElement)

        window.addEventListener('resize', this.handleResize)
    }

    private buildSkyDome(): void {
        const radius = 450
        const geo = new THREE.SphereGeometry(radius, 32, 16)

        // Vertex color gradient: horizon color at equator → zenith color at top pole
        const horizon = new THREE.Color(PALETTE.skyHorizon)
        const zenith  = new THREE.Color(PALETTE.skyZenith)
        const pos     = geo.attributes.position as THREE.BufferAttribute
        const colBuf  = new Float32Array(pos.count * 3)

        for (let i = 0; i < pos.count; i++) {
            const t = Math.max(0, pos.getY(i) / radius) // 0 at equator, 1 at top
            const c = horizon.clone().lerp(zenith, t)
            colBuf[i * 3]     = c.r
            colBuf[i * 3 + 1] = c.g
            colBuf[i * 3 + 2] = c.b
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colBuf, 3))

        const mat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.BackSide, // render inside of sphere
            fog: false,           // sky must not be eaten by scene fog
            depthWrite: false,    // never write to depth buffer — sky is always "behind" everything
        })

        this.skyDome = new THREE.Mesh(geo, mat)
        this.scene.add(this.skyDome)
    }

    initPostProcessing(camera: THREE.Camera): void {
        this.postProcessor = new PostProcessor(this.renderer, this.scene, camera)
    }

    render(camera: THREE.Camera, dt = 0): void {
        // Keep dome centered on camera so it never gets clipped by the far plane
        this.skyDome.position.copy(camera.position)
        if (this.postProcessor) {
            this.postProcessor.render(dt)
        } else {
            this.renderer.render(this.scene, camera)
        }
    }

    onResize(callback: () => void): void {
        this.resizeCallbacks.push(callback)
    }

    private handleResize = (): void => {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.postProcessor?.setSize(window.innerWidth, window.innerHeight)
        for (const cb of this.resizeCallbacks) cb()
    }

}
