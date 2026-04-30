import * as THREE from 'three'

const BASE_MAT_PROPS = { depthTest: false, depthWrite: false }

// Polymer parts: grip, receiver body, handguard, magazine
const polymerMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.90, metalness: 0.15, ...BASE_MAT_PROPS })

// Metal parts: barrel, muzzle brake, scope
const metalMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.65, metalness: 0.55, ...BASE_MAT_PROPS })

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

// Barrel tip in group-local space (used for muzzle flash placement)
export const BARREL_TIP_LOCAL = new THREE.Vector3(0, 0.006, -0.62)

export class WeaponViewModel {
    readonly group: THREE.Group
    private time = 0

    constructor(camera: THREE.PerspectiveCamera) {
        this.group = new THREE.Group()

        const poly = polymerMat()
        const metal = metalMat()

        // --- Receiver ---
        // Upper rail where the scope mounts
        const upperReceiver = buildMesh(new THREE.BoxGeometry(0.05, 0.032, 0.22), poly)
        upperReceiver.position.set(0, 0.006, 0)

        // Lower receiver — slightly taller and offset down to create a split-body look
        const lowerReceiver = buildMesh(new THREE.BoxGeometry(0.046, 0.028, 0.18), poly)
        lowerReceiver.position.set(0, -0.024, 0.01)

        // --- Handguard (forward of receiver, wrapping around the barrel) ---
        const handguard = buildMesh(new THREE.BoxGeometry(0.044, 0.036, 0.17), poly)
        handguard.position.set(0, -0.002, -0.19)

        // --- Pistol grip (below/behind lower receiver, angled forward) ---
        const grip = buildMesh(new THREE.BoxGeometry(0.036, 0.08, 0.038), poly)
        grip.position.set(0, -0.072, 0.08)
        grip.rotation.x = -0.35

        // --- Magazine (below lower receiver, slight forward tilt) ---
        const mag = buildMesh(new THREE.BoxGeometry(0.026, 0.072, 0.032), poly)
        mag.position.set(0, -0.072, 0.02)
        mag.rotation.x = 0.12

        // --- Barrel (CylinderGeometry is along Y, rotate 90° on X to align with Z) ---
        const barrel = buildMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.44, 8), metal)
        barrel.rotation.x = Math.PI / 2
        barrel.position.set(0, 0.006, -0.38)

        // --- Muzzle brake at barrel tip ---
        const muzzle = buildMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 8), metal)
        muzzle.rotation.x = Math.PI / 2
        muzzle.position.set(0, 0.006, -0.607)

        // --- Scope (cylindrical tube replaces flat box) ---
        const scopeTube = buildMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 12), metal)
        scopeTube.rotation.x = Math.PI / 2
        scopeTube.position.set(0, 0.048, -0.02)

        // Eyepiece (flared rear bell)
        const eyepiece = buildMesh(new THREE.CylinderGeometry(0.021, 0.016, 0.03, 12), metal)
        eyepiece.rotation.x = Math.PI / 2
        eyepiece.position.set(0, 0.048, 0.065)

        // Objective (front bell)
        const objective = buildMesh(new THREE.CylinderGeometry(0.019, 0.016, 0.025, 12), metal)
        objective.rotation.x = Math.PI / 2
        objective.position.set(0, 0.048, -0.1)

        this.group.add(
            upperReceiver, lowerReceiver, handguard,
            grip, mag,
            barrel, muzzle,
            scopeTube, eyepiece, objective
        )
        this.group.position.set(GROUP_X, GROUP_Y, GROUP_Z)
        camera.add(this.group)
    }

    update(dt: number): void {
        this.time += dt
        // Subtle idle breathing sway
        this.group.position.y = GROUP_Y + Math.sin(this.time * 1.4) * 0.003
        this.group.position.x = GROUP_X + Math.sin(this.time * 0.8) * 0.001
    }
}
