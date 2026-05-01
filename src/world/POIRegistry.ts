export type ZoneCategory = 'poi' | 'city'

const pois: Array<{ x: number, z: number, type: ZoneCategory }> = []

export const POIRegistry = {
    register: (x: number, z: number, type: ZoneCategory) => {
        if (!pois.some(p => p.x === x && p.z === z && p.type === type)) {
            pois.push({ x, z, type })
        }
    },
    getAll: () => pois as ReadonlyArray<{ x: number, z: number, type: ZoneCategory }>,
}
