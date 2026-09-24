import { clamp } from '../core/math.ts'

export interface AABB {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export function aabb(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): AABB {
  return {
    minX: cx - hx,
    maxX: cx + hx,
    minY: cy - hy,
    maxY: cy + hy,
    minZ: cz - hz,
    maxZ: cz + hz,
  }
}

export function resolveCircle(
  x: number,
  z: number,
  radius: number,
  feetY: number,
  height: number,
  step: number,
  boxes: readonly AABB[],
): { x: number; z: number } {
  let px = x
  let pz = z
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      if (feetY + height <= b.minY + 0.02) continue
      if (feetY >= b.maxY - 0.02) continue
      const rise = b.maxY - feetY
      if (rise >= -0.08 && rise <= step) continue
      const cx = clamp(px, b.minX, b.maxX)
      const cz = clamp(pz, b.minZ, b.maxZ)
      let dx = px - cx
      let dz = pz - cz
      let d2 = dx * dx + dz * dz
      if (d2 >= radius * radius) continue
      if (d2 < 1e-8) {
        dx = px - (b.minX + b.maxX) * 0.5
        dz = pz - (b.minZ + b.maxZ) * 0.5
        d2 = dx * dx + dz * dz
        if (d2 < 1e-8) {
          dx = 1
          dz = 0
          d2 = 1
        }
      }
      const d = Math.sqrt(d2)
      const push = radius - d + 0.001
      px += (dx / d) * push
      pz += (dz / d) * push
    }
  }
  return { x: px, z: pz }
}

/** Highest walkable surface under a foot, including low props and bridges. */
export function groundTop(
  x: number,
  z: number,
  feetY: number,
  terrain: number,
  boxes: readonly AABB[],
  step = 0.58,
): number {
  let h = terrain
  for (const b of boxes) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
    if (b.maxY < h - 0.02) continue
    if (b.maxY > feetY + step) continue
    h = b.maxY
  }
  return h
}
