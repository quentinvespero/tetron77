import { defineConfig } from 'vite'
import path from 'path'

const root = import.meta.dirname

export default defineConfig({
    base: '/tetron77/',
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
            '@core':      path.resolve(root, 'src/core'),
            '@rendering': path.resolve(root, 'src/rendering'),
            '@physics':   path.resolve(root, 'src/physics'),
            '@player':    path.resolve(root, 'src/player'),
            '@world':     path.resolve(root, 'src/world'),
            '@ui':        path.resolve(root, 'src/ui'),
            '@audio':     path.resolve(root, 'src/audio'),
            '@weapons':   path.resolve(root, 'src/weapons'),
            '@enemies':   path.resolve(root, 'src/enemies'),
        },
    },
})
