export interface ChunkCoord {
    cx: number
    cz: number
}

export const chunkKey = (coord: ChunkCoord): string =>
    `${coord.cx},${coord.cz}`

export const coordEquals = (a: ChunkCoord, b: ChunkCoord): boolean =>
    a.cx === b.cx && a.cz === b.cz
