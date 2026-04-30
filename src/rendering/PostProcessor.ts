import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { ColorGradeShader } from './shaders/ColorGradeShader'
import { FilmGrainShader } from './shaders/FilmGrainShader'

export class PostProcessor {
    private composer: EffectComposer
    private grainPass: ShaderPass
    private time = 0

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        this.composer = new EffectComposer(renderer)
        this.composer.addPass(new RenderPass(scene, camera))

        const colorPass = new ShaderPass(ColorGradeShader)
        this.composer.addPass(colorPass)

        this.grainPass = new ShaderPass(FilmGrainShader)
        this.composer.addPass(this.grainPass)
    }

    render(dt: number): void {
        this.time += dt
        this.grainPass.uniforms['time']!.value = this.time
        this.composer.render()
    }

    setSize(width: number, height: number): void {
        this.composer.setSize(width, height)
    }
}
