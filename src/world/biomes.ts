import { clamp, fbm, hash2, lerp, smoothstep } from '../core/math.ts'

export type BiomeId = 'hub' | 'verdant' | 'neon' | 'fen' | 'glass'

export interface BiomeWeights {
  hub: number
  verdant: number
  neon: number
  fen: number
  glass: number
  dominant: BiomeId
}

const COLORS: Record<BiomeId, [number, number, number]> = {
  hub: [0.42, 0.4, 0.2],
  verdant: [0.18, 0.46, 0.14],
  neon: [0.06, 0.1, 0.12],
  fen: [0.14, 0.16, 0.12],
  glass: [0.9, 0.74, 0.46],
}

export interface Look {
  fog: [number, number, number]
  sky: [number, number, number]
  sun: [number, number, number]
  hemi: [number, number, number]
  ground: [number, number, number]
  sunPower: number
  fill: number
  fogNear: number
  fogFar: number
  exposure: number
  contrast: number
  gain: [number, number, number]
  lift: [number, number, number]
}

const LOOK: Record<BiomeId, Look> = {
  hub: {
    fog: [0.86, 0.74, 0.58],
    sky: [0.45, 0.66, 0.92],
    sun: [1, 0.93, 0.78],
    hemi: [0.72, 0.8, 0.95],
    ground: [0.42, 0.3, 0.18],
    sunPower: 2.7,
    fill: 0.42,
    fogNear: 22,
    fogFar: 98,
    exposure: 1.12,
    contrast: 1.06,
    gain: [1.05, 0.98, 0.9],
    lift: [0.012, 0.006, 0],
  },
  verdant: {
    fog: [0.62, 0.78, 0.52],
    sky: [0.38, 0.64, 0.86],
    sun: [1, 0.96, 0.82],
    hemi: [0.62, 0.82, 0.7],
    ground: [0.16, 0.28, 0.12],
    sunPower: 2.45,
    fill: 0.38,
    fogNear: 26,
    fogFar: 118,
    exposure: 1.08,
    contrast: 1.08,
    gain: [0.94, 1.08, 0.9],
    lift: [0, 0.012, 0],
  },
  neon: {
    fog: [0.16, 0.1, 0.28],
    sky: [0.08, 0.04, 0.16],
    sun: [0.72, 0.82, 1],
    hemi: [0.28, 0.22, 0.48],
    ground: [0.05, 0.08, 0.1],
    sunPower: 1.15,
    fill: 0.22,
    fogNear: 12,
    fogFar: 64,
    exposure: 0.9,
    contrast: 1.16,
    gain: [0.82, 1.04, 1.18],
    lift: [0.015, 0, 0.03],
  },
  fen: {
    fog: [0.28, 0.32, 0.28],
    sky: [0.32, 0.38, 0.36],
    sun: [0.82, 0.86, 0.74],
    hemi: [0.4, 0.46, 0.4],
    ground: [0.1, 0.12, 0.09],
    sunPower: 1.45,
    fill: 0.2,
    fogNear: 10,
    fogFar: 58,
    exposure: 0.86,
    contrast: 1.02,
    gain: [0.88, 0.94, 0.86],
    lift: [0.02, 0.022, 0.016],
  },
  glass: {
    fog: [0.98, 0.88, 0.68],
    sky: [0.96, 0.72, 0.46],
    sun: [1, 0.9, 0.7],
    hemi: [1, 0.86, 0.68],
    ground: [0.62, 0.48, 0.28],
    sunPower: 3.35,
    fill: 0.55,
    fogNear: 24,
    fogFar: 120,
    exposure: 1.28,
    contrast: 1.1,
    gain: [1.1, 1.02, 0.86],
    lift: [0.02, 0.01, 0],
  },
}

export function biomeAt(x: number, z: number): BiomeWeights {
  const hub = smoothstep(38, 11, Math.hypot(x, z))
  const verdant = smoothstep(-4, -40, x)
  const neon = smoothstep(8, 44, x)
  const fen = smoothstep(-16, -52, z) * (1 - neon * 0.55)
  const glass = smoothstep(18, 56, z)
  const sum = verdant + neon + fen + glass
  const inv = sum > 0.001 ? 1 / sum : 0
  const weights: BiomeWeights = {
    hub,
    verdant: verdant * inv,
    neon: neon * inv,
    fen: fen * inv,
    glass: glass * inv,
    dominant: 'hub',
  }
  if (hub > 0.58) {
    weights.dominant = 'hub'
    return weights
  }
  const order: [BiomeId, number][] = [
    ['verdant', weights.verdant],
    ['neon', weights.neon],
    ['fen', weights.fen],
    ['glass', weights.glass],
  ]
  order.sort((a, b) => b[1] - a[1])
  weights.dominant = order[0][0]
  return weights
}

export function areaName(id: BiomeId): string {
  switch (id) {
    case 'hub':
      return 'Crosscamp'
    case 'verdant':
      return 'Verdant Rift'
    case 'neon':
      return 'Neon Vein'
    case 'fen':
      return 'Bone Fen'
    case 'glass':
      return 'Glass Expanse'
  }
}

export function biomeColor(x: number, z: number, wet: number): [number, number, number] {
  const w = biomeAt(x, z)
  let r = 0
  let g = 0
  let b = 0
  const mix = (id: BiomeId, t: number) => {
    const c = COLORS[id]
    r += c[0] * t
    g += c[1] * t
    b += c[2] * t
  }
  const field = 1 - w.hub
  mix('verdant', w.verdant * field)
  mix('neon', w.neon * field)
  mix('fen', w.fen * field)
  mix('glass', w.glass * field)
  mix('hub', w.hub)
  if (field + w.hub < 0.01) mix('hub', 1)

  const grain = fbm(x * 0.09, z * 0.09)
  const lift = (grain - 0.5) * 0.18
  r = clamp(r + lift, 0, 1)
  g = clamp(g + lift * 0.85, 0, 1)
  b = clamp(b + lift * 0.55, 0, 1)

  if (w.neon > 0.4 && hash2(Math.floor(x * 0.85) + 3, Math.floor(z * 0.85)) > 0.78) {
    r = lerp(r, 0.05, 0.82)
    g = lerp(g, 0.92, 0.82)
    b = lerp(b, 0.84, 0.82)
  }
  if (w.verdant > 0.35) {
    const patch = fbm(x * 0.07, z * 0.07)
    if (patch > 0.58) {
      g = clamp(g + 0.12, 0, 1)
      r = clamp(r - 0.03, 0, 1)
    } else if (patch < 0.32) {
      r = clamp(r + 0.05, 0, 1)
      g = clamp(g - 0.04, 0, 1)
    }
  }
  if (w.fen > 0.4 && hash2(Math.floor(x * 0.4), Math.floor(z * 0.4) + 9) > 0.84) {
    r = lerp(r, 0.72, 0.55)
    g = lerp(g, 0.68, 0.55)
    b = lerp(b, 0.58, 0.55)
  }
  if (w.glass > 0.4) {
    const salt = fbm(x * 0.05, z * 0.05)
    r = clamp(r + salt * 0.08, 0, 1)
    b = clamp(b - salt * 0.05, 0, 1)
  }
  if (wet > 0) {
    const shore = wet < 0.48
    if (shore) {
      const t = wet * 1.5
      r = lerp(r, r * 0.62 + 0.06, t)
      g = lerp(g, g * 0.58 + 0.05, t)
      b = lerp(b, b * 0.5 + 0.04, t)
    } else {
      r = lerp(r, 0.04, wet)
      g = lerp(g, 0.14, wet)
      b = lerp(b, 0.16, wet)
    }
  }
  return [r, g, b]
}

const scratch: Look = {
  fog: [0, 0, 0],
  sky: [0, 0, 0],
  sun: [0, 0, 0],
  hemi: [0, 0, 0],
  ground: [0, 0, 0],
  sunPower: 1,
  fill: 0,
  fogNear: 30,
  fogFar: 120,
  exposure: 1,
  contrast: 1,
  gain: [1, 1, 1],
  lift: [0, 0, 0],
}

const parts: [BiomeId, number][] = [
  ['verdant', 0],
  ['neon', 0],
  ['fen', 0],
  ['glass', 0],
  ['hub', 0],
]

export function biomeLook(x: number, z: number): Look {
  const w = biomeAt(x, z)
  const field = 1 - w.hub
  parts[0]![1] = w.verdant * field
  parts[1]![1] = w.neon * field
  parts[2]![1] = w.fen * field
  parts[3]![1] = w.glass * field
  parts[4]![1] = Math.max(w.hub, field + w.hub < 0.01 ? 1 : 0)
  zero3(scratch.fog)
  zero3(scratch.sky)
  zero3(scratch.sun)
  zero3(scratch.hemi)
  zero3(scratch.ground)
  zero3(scratch.gain)
  zero3(scratch.lift)
  scratch.sunPower = 0
  scratch.fill = 0
  scratch.fogNear = 0
  scratch.fogFar = 0
  scratch.exposure = 0
  scratch.contrast = 0
  for (const [id, t] of parts) {
    if (t <= 0) continue
    const look = LOOK[id]
    add3(scratch.fog, look.fog, t)
    add3(scratch.sky, look.sky, t)
    add3(scratch.sun, look.sun, t)
    add3(scratch.hemi, look.hemi, t)
    add3(scratch.ground, look.ground, t)
    add3(scratch.gain, look.gain, t)
    add3(scratch.lift, look.lift, t)
    scratch.sunPower += look.sunPower * t
    scratch.fill += look.fill * t
    scratch.fogNear += look.fogNear * t
    scratch.fogFar += look.fogFar * t
    scratch.exposure += look.exposure * t
    scratch.contrast += look.contrast * t
  }
  return scratch
}

function zero3(c: [number, number, number]): void {
  c[0] = 0
  c[1] = 0
  c[2] = 0
}

function add3(out: [number, number, number], c: [number, number, number], t: number): void {
  out[0] += c[0] * t
  out[1] += c[1] * t
  out[2] += c[2] * t
}
