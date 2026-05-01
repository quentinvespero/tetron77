import * as THREE from 'three'

// Shared singletons — never disposed
export const MAT_ENEMY_BODY = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.6,
    metalness: 0.5,
})

export const MAT_ENEMY_JOINT = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.85,
    metalness: 0.2,
})

// Per-enemy clone for hit-flash effect
export const makeSensorMat = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
    })
