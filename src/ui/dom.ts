/** Typed wrapper around getElementById that throws a clear error when the element is missing. */
export const getEl = (id: string): HTMLElement => {
    const el = document.getElementById(id)
    if (!el) throw new Error(`Missing DOM element: #${id}`)
    return el
}
