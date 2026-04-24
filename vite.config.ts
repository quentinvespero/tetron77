import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
    base: './',
    assetsInclude: ['**/*.png'],
    optimizeDeps: {
        // Rapier ships its own WASM — Vite must not pre-bundle it
        exclude: ['@dimforge/rapier3d-compat'],
    },
    build: {
        // WASM + top-level await require esnext target
        target: 'esnext',
    },
    resolve: {
        alias: {
            '@core':      path.resolve(__dirname, 'src/core'),
            '@rendering': path.resolve(__dirname, 'src/rendering'),
            '@physics':   path.resolve(__dirname, 'src/physics'),
            '@player':    path.resolve(__dirname, 'src/player'),
            '@world':     path.resolve(__dirname, 'src/world'),
        },
    },
})
