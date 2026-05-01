import type { ZoneCategory } from '@world/POIRegistry'

const BAR_W      = 480
const BAR_H      = 58
const PX_PER_RAD = BAR_W / Math.PI   // 90° = half the bar width
const HALF_FOV   = Math.PI / 2       // ±90° visible window
const MAX_DIST   = 1200              // metres — POIs beyond this are hidden

const DIRECTIONS = [
    { label: 'N',  bearing: 0,                cardinal: true  },
    { label: 'NE', bearing: Math.PI / 4,      cardinal: false },
    { label: 'E',  bearing: Math.PI / 2,      cardinal: true  },
    { label: 'SE', bearing: 3 * Math.PI / 4,  cardinal: false },
    { label: 'S',  bearing: Math.PI,          cardinal: true  },
    { label: 'SW', bearing: -3 * Math.PI / 4, cardinal: false },
    { label: 'W',  bearing: -Math.PI / 2,     cardinal: true  },
    { label: 'NW', bearing: -Math.PI / 4,     cardinal: false },
]

// Wraps angle to (-π, π]
const normalizeAngle = (a: number) =>
    a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI))

const ZONE_STYLE: Record<ZoneCategory, { icon: string, iconColor: string, distColor: string }> = {
    poi:  { icon: '◆', iconColor: '#eee', distColor: '#777' },
    city: { icon: '■', iconColor: '#aaa', distColor: '#555' },
}

export class Compass {
    private readonly ctx: CanvasRenderingContext2D

    constructor() {
        const canvas = document.getElementById('compass') as HTMLCanvasElement | null
        if (!canvas) throw new Error('Compass: #compass canvas not found in DOM')
        this.ctx = canvas.getContext('2d')!
    }

    update(
        yaw: number,
        px: number,
        pz: number,
        pois: ReadonlyArray<{ x: number, z: number, type: ZoneCategory }>,
    ): void {
        const { ctx } = this
        ctx.clearRect(0, 0, BAR_W, BAR_H)

        // Three.js forward = (-sin(yaw), 0, -cos(yaw))
        // Compass bearing of forward (clockwise from north/-Z) = atan2(-sin, cos) = -yaw
        const heading = -yaw

        // --- Horizontal track line ---
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, 48)
        ctx.lineTo(BAR_W, 48)
        ctx.stroke()

        // --- Direction labels + tick marks ---
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (const dir of DIRECTIONS) {
            const offset = normalizeAngle(dir.bearing - heading)
            if (Math.abs(offset) > HALF_FOV + 0.08) continue
            const x = BAR_W / 2 + offset * PX_PER_RAD

            ctx.fillStyle = dir.cardinal ? '#555' : '#2e2e2e'
            const tickTop    = dir.cardinal ? 46 : 48
            const tickHeight = dir.cardinal ? 10 : 6
            ctx.fillRect(x - 0.5, tickTop, 1, tickHeight)

            ctx.font      = dir.cardinal ? 'bold 11px monospace' : '10px monospace'
            ctx.fillStyle = dir.cardinal ? '#999' : '#444'
            ctx.fillText(dir.label, x, 38)
        }

        // --- Fixed center cursor (brighter tick) ---
        ctx.fillStyle = '#ccc'
        ctx.fillRect(BAR_W / 2 - 0.5, 42, 1, 16)

        // --- POI markers ---
        for (const poi of pois) {
            const dx   = poi.x - px
            const dz   = poi.z - pz
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > MAX_DIST) continue

            // Bearing: 0 = north (-Z), π/2 = east (+X)
            const bearing = Math.atan2(dx, -dz)
            const offset  = normalizeAngle(bearing - heading)
            if (Math.abs(offset) > HALF_FOV - 0.04) continue

            const x = BAR_W / 2 + offset * PX_PER_RAD

            const style = ZONE_STYLE[poi.type]

            ctx.font      = 'bold 13px monospace'
            ctx.fillStyle = style.iconColor
            ctx.fillText(style.icon, x, 12)

            ctx.font      = '9px monospace'
            ctx.fillStyle = style.distColor
            ctx.fillText(`${Math.round(dist)}m`, x, 25)
        }
    }
}
