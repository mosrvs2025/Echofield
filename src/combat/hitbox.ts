export interface Strike {
  x: number
  y: number
  z: number
  radius: number
  damage: number
  poise: number
  knock: number
  swingId: number
  fromX: number
  fromZ: number
  team: 'player' | 'enemy'
  heavy: boolean
}

let nextId = 1

export function nextSwing(): number {
  nextId += 1
  return nextId
}

export function overlaps(
  ax: number,
  ay: number,
  az: number,
  ar: number,
  bx: number,
  by: number,
  bz: number,
  br: number,
): boolean {
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  const r = ar + br
  return dx * dx + dy * dy + dz * dz <= r * r
}
