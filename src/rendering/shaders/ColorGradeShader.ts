export const ColorGradeShader = {
    uniforms: {
        tDiffuse:        { value: null },
        saturation:      { value: 0.8 }, // 0 = full grayscale, 1 = original color
        brightness:      { value: -0.007  }, // additive lift applied before contrast
        contrast:        { value: 1 },
        vignetteStrength:{ value: 1  },
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
        uniform float saturation;
        uniform float brightness;
        uniform float contrast;
        uniform float vignetteStrength;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // Desaturation — preserves perceived luminance
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(luma), color.rgb, saturation);

            // Brightness lift before contrast so dark scenes don't get crushed to black
            color.rgb += brightness;

            // Contrast
            color.rgb = (color.rgb - 0.5) * contrast + 0.5;

            // Vignette — darkens edges, focuses eye toward center
            vec2 uv = vUv - 0.5;
            float vignette = 1.0 - dot(uv, uv) * vignetteStrength;
            color.rgb *= clamp(vignette, 0.0, 1.0);

            gl_FragColor = clamp(color, 0.0, 1.0);
        }
    `,
}
