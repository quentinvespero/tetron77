# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

See `DESIGN.md` for the full design specification.

## Tech Stack

| Layer | Choice |
|---|---|
| Rendering | Three.js |
| Physics | Rapier (WASM) |
| Hosting | Static site (Vercel / Netlify / GitHub Pages) |
| Backend | None — fully client-side |

## Dev Setup

Not yet configured. When implemented, this project will use pnpm + TypeScript + Vite (static bundler):
- `pnpm dev` — local dev server
- `pnpm build` — production build

## Aesthetic

Near black-and-white, desaturated palette. Futuristic post-apocalyptic setting — ruined cities, dead landscapes, cold and oppressive.
All generated geometry and materials should default to dark, low-saturation values.

## Architecture

### World Generation
- World layout defined by a **hand-crafted PNG image map** — each pixel color maps to a zone type:

| Color | Hex | Zone type |
|---|---|---|
| Black | `#000000` | Mountains |
| Blue | `#0000ff` | Water |
| Gray | `#888888` | City ruins |
| Red | `#ff0000` | Encounter zone |
| Yellow | `#ffff00` | Point of interest |
| White | `#ffffff` | Plains |

- Zone content is **procedurally generated client-side** at runtime per zone type
- **Chunk-based streaming**: chunks load/unload as the player moves

### Player Systems
- Username entry before session starts (no auth/account)
- Health: generous/forgiving — player should not die easily
- Weapons: starts with a basic weapon; better ones found via exploration
- Death: respawn at last safe location (not a full reset); session ends on explicit quit only
- No persistence: all state is session-only

### Core Systems (to be built)
- Zone parser: reads PNG map → determines zone type per region
- Chunk manager: tracks loaded chunks, triggers gen/unload
- Procedural generators: one per zone type (terrain, city, encounter, POI)
- Physics integration: Rapier handles collisions and gravity, separate from Three.js scene
- Player controller: first-person, username entry, health, weapon slots, respawn at last safe location

### Post-Processing
Pipeline: `RenderPass → ColorGradePass → FilmGrainPass` via Three.js `EffectComposer` (`src/rendering/PostProcessor.ts`).
Visual knobs are the shader uniforms in `src/rendering/shaders/` — `saturation`, `contrast`, `vignetteStrength` (ColorGrade) and `intensity` (FilmGrain).

### UI
Intentionally minimal — only health bar and compass (compass shows nearby unexplored POIs as player rotates).

## Design Constraints
- Static site only — no server, no database, no auth
- Session-only state — nothing persists between sessions
- Keep loading screens minimal; chunk streaming should handle most of the world seamlessly
