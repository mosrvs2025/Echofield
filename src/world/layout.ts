import { distToSeg } from '../core/math.ts'

/** Shared landmark coordinates for the vertical slice. +X is east (Neon Vein). */
export const LAYOUT = {
  limit: 112,
  spawn: { x: 0, z: 11 },
  hub: { x: 0, z: 0, r: 16, h: 3.15 },
  camp: { x: -72, z: -2, r: 13, h: 4.25 },
  stone: { x: -54, z: 11, r: 6, h: 4.05 },
  needle: { x: 88, z: 2, r: 12, h: 3.45 },
  lake: { x: -36, z: 30, rx: 17, rz: 12, surface: 2.2, bed: 0.12 },
  canal: { x: 48, z: 0, hx: 5.6, hz: 18, surface: 2.05, bed: 0.22 },
  fen: { x: 6, z: -70, rx: 16, rz: 10, surface: 1.65, bed: -0.15 },
  keeper: { x: 3.5, z: -1.6 },
  bridge: { x: 48, z: 0, top: 3.42 },
  boneArch: { x: -10, z: -84 },
  saltSpire: { x: 8, z: 86 },
} as const

export function onClearedGround(x: number, z: number, pad = 4.2): boolean {
  const L = LAYOUT
  if (Math.hypot(x - L.hub.x, z - L.hub.z) < 12) return true
  if (Math.hypot(x - L.camp.x, z - L.camp.z) < L.camp.r + 1) return true
  if (Math.hypot(x - L.needle.x, z - L.needle.z) < L.needle.r * 0.75) return true
  if (Math.hypot(x - L.stone.x, z - L.stone.z) < 5) return true
  if (distToSeg(x, z, -8, 1, -64, -2) < pad) return true
  if (distToSeg(x, z, 8, 1, 40, 0) < pad) return true
  if (distToSeg(x, z, 57, 0, 80, 2) < pad) return true
  if (distToSeg(x, z, -8, 2, -36, 22) < 3.2) return true
  return false
}
