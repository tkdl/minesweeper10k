export function idiv(a: number, b: number): number { return a / b | 0; }

export function clamp(x: number, min: number, max: number) {return Math.min( Math.max(x, min), max); }

export function hash(x: number): number {
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = (x >> 16) ^ x;
    return x;
}