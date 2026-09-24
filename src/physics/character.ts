import { clamp } from '../core/math.ts'
import { resolveCircle, type AABB } from './colliders.ts'

export interface Body {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  pushX: number
  pushZ: number
  grounded: boolean
  swimming: boolean
  coyote: number
  depth: number
  landedHard: boolean
  enteredWater: boolean
  exitedWater: boolean
}

export interface Intent {
  wishX: number
  wishZ: number
  speed: number
  jump: boolean
}

export interface Probe {
  ground: (x: number, z: number, feetY: number) => number
  waterSurface: (x: number, z: number) => number | null
  blocks: readonly AABB[]
  limit: number
}

export const BODY_RADIUS = 0.42
export const BODY_HEIGHT = 1.7
const STEP = 0.58
const GRAVITY = 28
const JUMP_V = 8.4

export function createBody(x: number, z: number, y: number): Body {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    pushX: 0,
    pushZ: 0,
    grounded: true,
    swimming: false,
    coyote: 0.1,
    depth: 0,
    landedHard: false,
    enteredWater: false,
    exitedWater: false,
  }
}

export function stepCharacter(body: Body, intent: Intent, probe: Probe, dt: number): void {
  body.landedHard = false
  body.enteredWater = false
  body.exitedWater = false
  const wasSwim = body.swimming

  body.pushX *= Math.exp(-7 * dt)
  body.pushZ *= Math.exp(-7 * dt)

  let wishX = intent.wishX
  let wishZ = intent.wishZ
  const mag = Math.hypot(wishX, wishZ)
  if (mag > 1) {
    wishX /= mag
    wishZ /= mag
  }

  body.vx = wishX * intent.speed + body.pushX
  body.vz = wishZ * intent.speed + body.pushZ

  let nx = body.x + body.vx * dt
  let nz = body.z + body.vz * dt
  const resolved = resolveCircle(nx, nz, BODY_RADIUS, body.y, BODY_HEIGHT, STEP, probe.blocks)
  nx = resolved.x
  nz = resolved.z

  if (!body.swimming && body.grounded) {
    const g0 = probe.ground(body.x, body.z, body.y)
    const g1 = probe.ground(nx, nz, body.y)
    if (g1 - g0 > STEP) {
      const gx = probe.ground(nx, body.z, body.y)
      const gz = probe.ground(body.x, nz, body.y)
      if (gx - g0 <= STEP) nz = body.z
      else if (gz - g0 <= STEP) nx = body.x
      else {
        nx = body.x
        nz = body.z
      }
    }
  }

  body.x = clamp(nx, -probe.limit, probe.limit)
  body.z = clamp(nz, -probe.limit, probe.limit)

  const surface = probe.waterSurface(body.x, body.z)
  const floorNow = probe.ground(body.x, body.z, body.y)
  const depth = surface === null ? 0 : surface - Math.min(floorNow, surface)
  body.depth = depth

  const canSwim = surface !== null && depth > 0.82 && body.y < surface - 0.22 && body.vy < 5.5

  if (canSwim && surface !== null) {
    body.swimming = true
    body.grounded = false
    body.coyote = 0
    if (intent.jump) {
      body.swimming = false
      body.vy = 6.4
      body.y = Math.max(body.y, surface - 0.05)
    } else {
      const target = surface - 0.58
      body.y += (target - body.y) * Math.min(1, dt * 5)
      body.vy = 0
    }
  } else {
    body.swimming = false
    if (intent.jump && (body.grounded || body.coyote > 0)) {
      body.vy = JUMP_V
      body.grounded = false
      body.coyote = 0
    } else {
      body.vy -= GRAVITY * dt
    }
    const prevVy = body.vy
    body.y += body.vy * dt
    const g = probe.ground(body.x, body.z, body.y)
    if (body.y <= g && body.vy <= 0) {
      if (prevVy < -9) body.landedHard = true
      body.y = g
      body.vy = 0
      body.grounded = true
      body.coyote = 0.12
    } else {
      body.grounded = body.y <= g + 0.02
      body.coyote = Math.max(0, body.coyote - dt)
    }
  }

  if (body.swimming && !wasSwim) body.enteredWater = true
  if (!body.swimming && wasSwim) body.exitedWater = true
}

export function shove(body: Body, dirX: number, dirZ: number, force: number): void {
  const len = Math.hypot(dirX, dirZ) || 1
  body.pushX += (dirX / len) * force
  body.pushZ += (dirZ / len) * force
}
