export interface WeaponDef {
    id: string
    name: string
    magazineSize: number
    reloadTime: number    // seconds
    fireRate: number      // shots per second (max fire rate)
    range: number         // max raycast distance in world units
    defaultFov: number    // normal field of view
    scopeFov: number      // field of view when scoped in
    spread: number        // radians of random cone spread when hip-firing
}

export const RIFLE: WeaponDef = {
    id: 'rifle',
    name: 'Rifle',
    magazineSize: 8,
    reloadTime: 2.0,
    fireRate: 2,
    range: 300,
    defaultFov: 65,
    scopeFov: 28,
    spread: 0.003,
}
