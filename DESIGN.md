# Game Design Document

## Overview

A browser-based, single-player, first-person 3D open world exploration game.
The world is vast, dark, and devastated — a futuristic post-apocalyptic setting rendered in a near black-and-white aesthetic.
The player explores, finds treasures and better weapons, and survives random enemy encounters.
There is no save system — each session is a fresh run. Death sends the player back to their last safe location.

---

## Aesthetic

- Near black-and-white color palette — desaturated, cold, oppressive
- Futuristic but destroyed world — ruined cities, collapsed infrastructure, dead landscapes
- Atmospheric and immersive — the world should feel lonely and vast

---

## World Design

### Structure

The world is large and built on two layers:

- **Zone layout** — hand-crafted image map (PNG). Each pixel color maps to a zone type. Authored in a pixel art editor (e.g. Aseprite) with hard edges and no anti-aliasing
- **Zone content** — procedurally generated within each zone at runtime based on the zone type

### Zone color palette

| Color | Hex | Zone type |
|---|---|---|
| Black | `#000000` | Mountains |
| Blue | `#0000ff` | Water |
| Gray | `#888888` | City ruins |
| Red | `#ff0000` | Encounter zone |
| Yellow | `#ffff00` | Point of interest |
| White | `#ffffff` | Plains |

| Zone type | Description |
|---|---|
| Terrain | Mountains, plains, valleys — procedural geometry |
| Water | Rivers, lakes, flooded areas |
| City | Ruined buildings, streets, debris |
| Encounter | Areas where enemies can randomly spawn |
| Points of interest | Locations with treasures, lore, landmarks |

### Streaming

The world uses a **chunk-based streaming system** — chunks are generated and loaded as the player approaches, and unloaded when far away.
A few loading screens are acceptable (e.g. initial load), but should be minimized.

---

## Player

### Identity
- Player enters a **username** before starting — no account or password required
- Session only — no progress is saved between sessions

### Stats
- **Health bar** — generous, forgiving. The player should not die easily
- **Weapons** — player starts with a basic weapon and can find better ones while exploring

### On Death
- Player **respawns at their last safe location** (not a full reset)

---

## Gameplay Loop

```
Start session → Enter world → Explore → Find treasures / better weapons
    → Encounter enemies → Survive → Explore further → Eventually die → Session ends
```

- No explicit win condition — the game is **exploration-driven**
- The player is motivated by discovery: new zones, treasures, upgraded weapons
- Interactions beyond movement TBD

---

## UI

Minimal UI — only two permanent elements:

| Element | Description |
|---|---|
| **Health bar** | Displays current player health |
| **Compass** | As the player rotates, shows nearby **unexplored points of interest** around them |

No minimap, no quest markers, no HUD clutter.

---

## Open / TBD

- Player interactions beyond movement (doors, objects, etc.)
- Enemy types and behavior
- Weapon variety and upgrade system detail
- Treasure types and what finding them does
- Whether there is any narrative or ending
- Zone content procedural rules per zone type (what exactly generates in a city vs mountain vs encounter zone)
