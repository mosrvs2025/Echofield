import { lerp, fbm, smoothstep } from '../core/math.ts'
import { biomeAt } from '../world/biomes.ts'
import { LAYOUT } from '../world/layout.ts'

function ellipse(x: number, z: number, cx: number, cz: number, rx: number, rz: number): number {
  return Math.hypot((x - cx) / rx, (z - cz) / rz)
}

function carveEllipse(
  x: number,
  z: number,
  h: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  bed: number,
): number {
  const d = ellipse(x, z, cx, cz, rx, rz)
  const w = smoothstep(1.08, 0.52, d)
  if (w <= 0) return h
  const bowl = bed + d * 0.55
  return lerp(h, Math.min(h, bowl), w)
}

function pad(x: number, z: number, h: number, cx: number, cz: number, r: number, target: number): number {
  const d = Math.hypot(x - cx, z - cz)
  const w = smoothstep(r, r * 0.42, d)
  return lerp(h, target, w)
}

export function terrainHeight(x: number, z: number): number {
  const b = biomeAt(x, z)
  const n = fbm(x * 0.018, z * 0.018)
  const n2 = fbm(x * 0.05 + 19, z * 0.05 - 7)
  let h = 3.3
  h += (n - 0.5) * 7.2
  h += b.verdant * ((n2 - 0.32) * 5.2 + Math.abs(Math.sin(x * 0.07) * Math.cos(z * 0.05)) * 1.5)
  h += b.neon * (Math.abs(n2 - 0.5) * 7 - 1.6)
  h += b.fen * ((n - 0.55) * 2.4 - 0.7)
  h += b.glass * (n2 - 0.5) * 1.6

  const lake = LAYOUT.lake
  h = carveEllipse(x, z, h, lake.x, lake.z, lake.rx, lake.rz, lake.bed)
  const canal = LAYOUT.canal
  const along = smoothstep(canal.hz + 2, canal.hz * 0.55, Math.abs(z - canal.z))
  const across = smoothstep(canal.hx + 2.4, canal.hx * 0.42, Math.abs(x - canal.x))
  const cw = along * across
  if (cw > 0) h = lerp(h, canal.bed + Math.abs(z - canal.z) * 0.02, cw)
  const fen = LAYOUT.fen
  h = carveEllipse(x, z, h, fen.x, fen.z, fen.rx, fen.rz, fen.bed)

  // Trails and pads win over carves so camps, the hub, and roads stay walkable.
  const west = smoothstep(6.2, 1.4, segment(x, z, -8, 1, -64, -2))
  h = lerp(h, 4.05, west * 0.88)
  const lakeSpur = smoothstep(4.2, 1.1, segment(x, z, -12, 4, -32, 20))
  h = lerp(h, 3.5, lakeSpur * 0.75)
  const eastA = smoothstep(6, 1.3, segment(x, z, 8, 1, 40, 0))
  const eastB = smoothstep(6, 1.3, segment(x, z, 57, 0, 80, 2))
  h = lerp(h, 3.45, Math.max(eastA, eastB) * 0.88)

  h = pad(x, z, h, LAYOUT.hub.x, LAYOUT.hub.z, LAYOUT.hub.r, LAYOUT.hub.h)
  h = pad(x, z, h, LAYOUT.camp.x, LAYOUT.camp.z, LAYOUT.camp.r, LAYOUT.camp.h)
  h = pad(x, z, h, LAYOUT.stone.x, LAYOUT.stone.z, LAYOUT.stone.r, LAYOUT.stone.h)
  h = pad(x, z, h, LAYOUT.needle.x, LAYOUT.needle.z, LAYOUT.needle.r, LAYOUT.needle.h)
  return h
}

function segment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax
  const abz = bz - az
  const len2 = abx * abx + abz * abz
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / len2))
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t))
}

/** Water surface Y if (x, z) is inside a swim volume, else null. */
export function waterSurface(x: number, z: number): number | null {
  const lake = LAYOUT.lake
  if (ellipse(x, z, lake.x, lake.z, lake.rx, lake.rz) <= 1) return lake.surface
  const canal = LAYOUT.canal
  if (Math.abs(x - canal.x) <= canal.hx && Math.abs(z - canal.z) <= canal.hz) return canal.surface
  const fen = LAYOUT.fen
  if (ellipse(x, z, fen.x, fen.z, fen.rx, fen.rz) <= 1) return fen.surface
  return null
}

export function waterDepth(x: number, z: number): number {
  const surface = waterSurface(x, z)
  if (surface === null) return 0
  return surface - terrainHeight(x, z)
}
