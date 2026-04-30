export const FilmGrainShader = {
    uniforms: {
        tDiffuse:  { value: null },
        time:      { value: 0.0 },
        intensity: { value: 0.05 },
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        varying vec2 vUv;

        // Fast hash — different pattern every frame via time offset
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float grain = hash(vUv + fract(time)) * 2.0 - 1.0;
            color.rgb += grain * intensity;
            gl_FragColor = clamp(color, 0.0, 1.0);
        }
    `,
}
