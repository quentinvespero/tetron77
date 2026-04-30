import * as THREE from 'three'

const BASE_MAT_PROPS = { depthTest: false, depthWrite: false }

// Cerakote-finished chassis — near-black with tactical matte sheen
const chassisMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.50, metalness: 0.50, ...BASE_MAT_PROPS })

// Polished dark metal — barrel, bolt, scope hardware
const metalMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.18, metalness: 0.92, ...BASE_MAT_PROPS })

// Matte rubber — grip panels, cheekpiece pad, butt pad
const rubberMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.96, metalness: 0.02, ...BASE_MAT_PROPS })

const buildMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 999
    m.frustumCulled = false
    // Prevent weapon mesh from interfering with world raycast hit detection
    m.raycast = () => {}
    return m
}

// Position in camera local space
const GROUP_X = 0.26
const GROUP_Y = -0.22
const GROUP_Z = -0.42

// After rotation.x = PI/2: radiusTop is at +Z end (toward stock), radiusBottom at -Z end (toward muzzle)

// Barrel tip in group-local space (used for muzzle flash placement)
export const BARREL_TIP_LOCAL = new THREE.Vector3(0, 0.004, -0.72)

export class WeaponViewModel {
    readonly group: THREE.Group
    private time = 0
    private lagX = 0
    private lagY = 0

    constructor(camera: THREE.PerspectiveCamera) {
        this.group = new THREE.Group()
        const parts: THREE.Mesh[] = []
        const add = (m: THREE.Mesh) => { parts.push(m); return m }

        const chassis = chassisMat()
        const metal = metalMat()
        const rubber = rubberMat()

        // ── Action body ───────────────────────────────────────────────────────
        // Cylindrical receiver — hallmark of precision bolt-action rifles
        // Slightly wider at back (0.020) tapering to barrel diameter at front (0.018)
        const action = add(buildMesh(new THREE.CylinderGeometry(0.018, 0.020, 0.20, 12), metal))
        action.rotation.x = Math.PI / 2
        action.position.set(0, 0.010, 0)

        // Flat Picatinny rail mounted on top of action
        const topRail = add(buildMesh(new THREE.BoxGeometry(0.024, 0.007, 0.22), metal))
        topRail.position.set(0, 0.030, 0)

        // Rail cross-slot detail (3 evenly spaced notches)
        for (let i = -1; i <= 1; i++) {
            const slot = add(buildMesh(new THREE.BoxGeometry(0.020, 0.004, 0.008), chassis))
            slot.position.set(0, 0.033, i * 0.055)
        }

        // Bolt handle shaft — extends to the right of the action
        const boltShaft = add(buildMesh(new THREE.CylinderGeometry(0.004, 0.004, 0.038, 6), metal))
        boltShaft.rotation.z = Math.PI / 2
        boltShaft.position.set(0.040, 0.006, 0.055)

        // Bolt knob — spherical for the classic precision-rifle look
        const boltKnob = add(buildMesh(new THREE.SphereGeometry(0.010, 8, 6), metal))
        boltKnob.position.set(0.060, 0.006, 0.055)

        // ── Chassis / Stock ───────────────────────────────────────────────────
        // Main chassis body connecting action to buttstock
        const chassisBody = add(buildMesh(new THREE.BoxGeometry(0.032, 0.024, 0.165), chassis))
        chassisBody.position.set(0, 0.000, 0.130)

        // Elevated cheekpiece for proper scope eye alignment
        const cheekpiece = add(buildMesh(new THREE.BoxGeometry(0.028, 0.016, 0.088), rubber))
        cheekpiece.position.set(0, 0.022, 0.105)

        // Skeletal folding buttstock — two parallel chassis rails
        const railL = add(buildMesh(new THREE.BoxGeometry(0.004, 0.010, 0.095), chassis))
        railL.position.set(0.011, -0.003, 0.213)

        const railR = add(buildMesh(new THREE.BoxGeometry(0.004, 0.010, 0.095), chassis))
        railR.position.set(-0.011, -0.003, 0.213)

        // Thick rubber butt pad (end cap)
        const buttPad = add(buildMesh(new THREE.BoxGeometry(0.032, 0.046, 0.007), rubber))
        buttPad.position.set(0, 0.004, 0.263)

        // ── Handguard — slim cylindrical M-LOK ───────────────────────────────
        const handguard = add(buildMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.210, 12), chassis))
        handguard.rotation.x = Math.PI / 2
        handguard.position.set(0, 0.006, -0.205)

        // M-LOK slot notches on the bottom rail (4 slots)
        for (let i = 0; i < 4; i++) {
            const slot = add(buildMesh(new THREE.BoxGeometry(0.009, 0.007, 0.016), metal))
            slot.position.set(0, -0.016, -0.138 - i * 0.044)
        }

        // Flush end cap at front of handguard
        const hgCap = add(buildMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12), chassis))
        hgCap.rotation.x = Math.PI / 2
        hgCap.position.set(0, 0.006, -0.313)

        // ── Pistol grip ───────────────────────────────────────────────────────
        const grip = add(buildMesh(new THREE.BoxGeometry(0.028, 0.072, 0.032), rubber))
        grip.position.set(0, -0.062, 0.062)
        grip.rotation.x = -0.30

        // ── Trigger ───────────────────────────────────────────────────────────
        const triggerGuard = add(buildMesh(new THREE.BoxGeometry(0.040, 0.003, 0.044), chassis))
        triggerGuard.position.set(0, -0.050, 0.026)

        const trigger = add(buildMesh(new THREE.BoxGeometry(0.005, 0.020, 0.004), metal))
        trigger.position.set(0, -0.046, 0.018)
        trigger.rotation.x = 0.22

        // ── Magazine — compact AI-style box mag ───────────────────────────────
        const mag = add(buildMesh(new THREE.BoxGeometry(0.028, 0.052, 0.040), chassis))
        mag.position.set(0, -0.057, 0.008)

        const magBase = add(buildMesh(new THREE.BoxGeometry(0.030, 0.004, 0.042), metal))
        magBase.position.set(0, -0.083, 0.008)

        // ── Barrel — heavy contour, three-section taper ───────────────────────
        // Heavy uniform section from action to handguard exit
        // Z range: [-0.260, -0.100], connecting to action front at Z=-0.100
        const barrelBreech = add(buildMesh(new THREE.CylinderGeometry(0.013, 0.013, 0.160, 12), metal))
        barrelBreech.rotation.x = Math.PI / 2
        barrelBreech.position.set(0, 0.004, -0.180)

        // Tapered mid section: 0.013 at breech (radiusTop, +Z), 0.010 at muzzle (radiusBottom, -Z)
        // Z range: [-0.470, -0.260], seamlessly connecting to barrelBreech at -0.260
        const barrelMid = add(buildMesh(new THREE.CylinderGeometry(0.013, 0.010, 0.210, 12), metal))
        barrelMid.rotation.x = Math.PI / 2
        barrelMid.position.set(0, 0.004, -0.365)

        // Slender muzzle section: 0.010 → 0.008
        // Z range: [-0.670, -0.470], seamlessly connecting at -0.470
        const barrelTip = add(buildMesh(new THREE.CylinderGeometry(0.010, 0.008, 0.200, 12), metal))
        barrelTip.rotation.x = Math.PI / 2
        barrelTip.position.set(0, 0.004, -0.570)

        // Large tactical muzzle brake
        // Z range: [-0.718, -0.670], connecting at -0.670
        const muzzleBrake = add(buildMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.048, 8), metal))
        muzzleBrake.rotation.x = Math.PI / 2
        muzzleBrake.position.set(0, 0.004, -0.694)

        // Port vents on top of muzzle brake
        const portL = add(buildMesh(new THREE.BoxGeometry(0.005, 0.013, 0.022), chassis))
        portL.position.set(0.014, 0.013, -0.686)

        const portR = add(buildMesh(new THREE.BoxGeometry(0.005, 0.013, 0.022), chassis))
        portR.position.set(-0.014, 0.013, -0.686)

        // ── Scope — large high-power tactical (5-25×) ─────────────────────────
        // 30mm main tube
        // Z range: [-0.135, +0.065]
        const scopeTube = add(buildMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.200, 14), metal))
        scopeTube.rotation.x = Math.PI / 2
        scopeTube.position.set(0, 0.056, -0.035)

        // Elevation turret (top cap)
        const turretEl = add(buildMesh(new THREE.CylinderGeometry(0.008, 0.009, 0.018, 8), metal))
        turretEl.position.set(0, 0.080, -0.025)

        // Windage turret (side cap)
        const turretWind = add(buildMesh(new THREE.CylinderGeometry(0.008, 0.009, 0.018, 8), metal))
        turretWind.rotation.z = Math.PI / 2
        turretWind.position.set(0.034, 0.056, -0.025)

        // Eyepiece bell — flares toward the shooter (+Z end, radiusTop)
        // Neck (0.015) at Z=+0.065 connecting to tube, bell (0.024) at Z=+0.107
        const eyepiece = add(buildMesh(new THREE.CylinderGeometry(0.024, 0.015, 0.042, 14), metal))
        eyepiece.rotation.x = Math.PI / 2
        eyepiece.position.set(0, 0.056, 0.086)

        // Objective bell — flares toward the muzzle (-Z end, radiusBottom)
        // Neck (0.015) at Z=-0.135 connecting to tube, bell (0.028) at Z=-0.179
        const objective = add(buildMesh(new THREE.CylinderGeometry(0.015, 0.028, 0.044, 14), metal))
        objective.rotation.x = Math.PI / 2
        objective.position.set(0, 0.056, -0.157)

        // Sunshade extending from objective front
        // Z range: [-0.217, -0.179]
        const sunshade = add(buildMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.038, 14), metal))
        sunshade.rotation.x = Math.PI / 2
        sunshade.position.set(0, 0.056, -0.198)

        // Cantilever mount base (single-piece, spans both rings)
        const mountBase = add(buildMesh(new THREE.BoxGeometry(0.038, 0.012, 0.120), metal))
        mountBase.position.set(0, 0.035, -0.028)

        // Mount ring posts (elevate rings from the rail to the tube center)
        const post1 = add(buildMesh(new THREE.BoxGeometry(0.016, 0.018, 0.020), metal))
        post1.position.set(0, 0.040, 0.028)

        const post2 = add(buildMesh(new THREE.BoxGeometry(0.016, 0.018, 0.020), metal))
        post2.position.set(0, 0.040, -0.082)

        // Scope rings encircling the 30mm tube
        const ring1 = add(buildMesh(new THREE.TorusGeometry(0.020, 0.003, 8, 14), metal))
        ring1.position.set(0, 0.056, 0.028)

        const ring2 = add(buildMesh(new THREE.TorusGeometry(0.020, 0.003, 8, 14), metal))
        ring2.position.set(0, 0.056, -0.082)

        this.group.add(...parts)
        this.group.position.set(GROUP_X, GROUP_Y, GROUP_Z)
        camera.add(this.group)
    }

    update(dt: number, deltaYaw = 0, deltaPitch = 0): void {
        this.time += dt

        const LAG_SCALE_X  = 0.16
        const LAG_SCALE_Y  = 0.08
        const LAG_CLAMP_X  = 0.06
        const LAG_CLAMP_Y  = 0.03
        const RETURN_SPEED = 10

        this.lagX = THREE.MathUtils.clamp(
            this.lagX - deltaYaw * LAG_SCALE_X,
            -LAG_CLAMP_X, LAG_CLAMP_X
        )
        this.lagY = THREE.MathUtils.clamp(
            this.lagY - deltaPitch * LAG_SCALE_Y,
            -LAG_CLAMP_Y, LAG_CLAMP_Y
        )

        const decay = 1 - Math.min(1, RETURN_SPEED * dt)
        this.lagX *= decay
        this.lagY *= decay

        this.group.position.x = GROUP_X + Math.sin(this.time * 0.8) * 0.001 + this.lagX
        this.group.position.y = GROUP_Y + Math.sin(this.time * 1.4) * 0.003 + this.lagY
        this.group.rotation.z = -this.lagX * 4
    }
}
