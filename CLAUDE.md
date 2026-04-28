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

pnpm + TypeScript + Vite:
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

### Terrain
- Elevation is driven by **FBM (fractal brownian motion) noise** sampled in world-space — no heightmap PNG
- `src/world/TerrainSampler.ts` is the single source of truth: exports `sample(worldX, worldZ, zone)` and `TERRAIN_SEGS = 16`
- Zone type controls noise amplitude — each generator passes its own `ZoneType` to `sample()`

| Zone | Amplitude | Base Y | Feel |
|---|---|---|---|
| Plains | 6 | -1 | gentle rolling hills |
| Mountains | 28 | 4 | dramatic tall peaks |
| CityRuins | 3 | 0 | mostly flat, slight undulation |
| Encounter | 2 | 0 | open flat area |
| POI | 2 | 0 | flat for landmark visibility |
| Water | 0 | -2 | forced flat at sea level |

- All terrain meshes use `PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 16, 16)` with per-vertex Y displacement
- Ground physics use Rapier **heightfield colliders** (not flat cuboids) — must match the visual mesh exactly
- Noise is sampled in world-space, so adjacent chunks of the same zone type have seamless borders automatically
- Objects (rocks, buildings, debris, towers) sample `sample()` at their XZ position to sit on the terrain surface

### Player Systems
- Username entry before session starts (no auth/account)
- Health: generous/forgiving — player should not die easily
- Weapons: starts with a basic weapon; better ones found via exploration
- Death: respawn at last safe location (not a full reset); session ends on explicit quit only
- No persistence: all state is session-only

### Core Systems

Built:
- Zone parser (`MapParser.ts`): reads PNG map → determines zone type per region
- Chunk manager (`ChunkManager.ts`): tracks loaded chunks, triggers gen/unload (VIEW_RADIUS=3, UNLOAD_RADIUS=5)
- Procedural generators: one per zone type — Plain, Mountain, Water, CityRuins, Encounter, POI
- Terrain system (`TerrainSampler.ts`): FBM noise elevation + Rapier heightfield physics
- Physics integration (`PhysicsWorld.ts`): Rapier WASM, gravity -20
- Player controller: first-person movement, username entry, health, fall damage, respawn

Not yet built:
- Weapons system
- Compass HUD (showing nearby POIs)
- Enemies / encounter logic

### UI
Intentionally minimal — only health bar and compass (compass shows nearby unexplored POIs as player rotates).

## Design Constraints
- Static site only — no server, no database, no auth
- Session-only state — nothing persists between sessions
- Keep loading screens minimal; chunk streaming should handle most of the world seamlessly
