import * as THREE from 'three'

// Shared material for all weapon parts — rendered on top of world geometry
const buildMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.85,
        metalness: 0.3,
        depthTest: false,
        depthWrite: false,
    })

const buildMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 999
    m.frustumCulled = false
    // Disable raycasting so weapon doesn't interfere with hit detection
    m.raycast = () => {}
    return m
}

// Position in camera local space
const GROUP_X = 0.24
const GROUP_Y = -0.20
const GROUP_Z = -0.40

// Barrel tip offset within the group (used for muzzle flash placement)
export const BARREL_TIP_LOCAL = new THREE.Vector3(0, -0.003, -0.52)

export class WeaponViewModel {
    readonly group: THREE.Group
    private time = 0

    constructor(camera: THREE.PerspectiveCamera) {
        this.group = new THREE.Group()

        const mat = buildMat()

        // Main receiver body
        const body = buildMesh(new THREE.BoxGeometry(0.055, 0.05, 0.28), mat)

        // Barrel — cylinder along Z (CylinderGeometry is along Y, rotate 90° on X)
        const barrel = buildMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.38, 6), mat)
        barrel.rotation.x = Math.PI / 2
        barrel.position.set(0, -0.003, -0.33)

        // Scope body on top of receiver
        const scope = buildMesh(new THREE.BoxGeometry(0.028, 0.024, 0.10), mat)
        scope.position.set(0, 0.038, -0.02)

        this.group.add(body, barrel, scope)
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
