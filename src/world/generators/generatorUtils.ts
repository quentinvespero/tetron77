// Deterministic seeded random in [0,1) based on chunk coords + index
export const rng = (cx: number, cz: number, i: number): number => {
    const x = Math.sin(cx * 127.1 + cz * 311.7 + i * 74.1) * 10000
    return x - Math.floor(x)
}
