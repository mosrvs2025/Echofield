export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + delta * (1 - Math.exp(-lambda * dt))
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Yaw whose local -Z axis points along (x, z). Matches the camera rig. */
export function yawToward(x: number, z: number): number {
  return Math.atan2(-x, -z)
}

export function hash2(ix: number, iz: number): number {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

export function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const tx = x - x0
  const tz = z - z0
  const sx = tx * tx * (3 - 2 * tx)
  const sz = tz * tz * (3 - 2 * tz)
  const a = hash2(x0, z0)
  const b = hash2(x0 + 1, z0)
  const c = hash2(x0, z0 + 1)
  const d = hash2(x0 + 1, z0 + 1)
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz)
}

export function fbm(x: number, z: number): number {
  let n = 0
  let a = 1
  let f = 1
  let t = 0
  for (let i = 0; i < 4; i++) {
    n += a * valueNoise(x * f, z * f)
    t += a
    a *= 0.5
    f *= 2.05
  }
  return n / t
}

export function distToSeg(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const abx = bx - ax
  const abz = bz - az
  const len2 = abx * abx + abz * abz
  if (len2 < 1e-6) return Math.hypot(x - ax, z - az)
  const t = clamp(((x - ax) * abx + (z - az) * abz) / len2, 0, 1)
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t))
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
