import { yawToward } from '../core/math.ts'
import type { VirtualInput } from '../core/input.ts'
import type { ObjectiveStep } from './session.ts'
import { objectiveTarget } from './session.ts'
import { LAYOUT } from '../world/layout.ts'

export interface BotEnemy {
  x: number
  z: number
  alive: boolean
  winding: boolean
  archetype: string
}

export interface BotView {
  x: number
  z: number
  step: ObjectiveStep
  time: number
  rested: boolean
  enemies: BotEnemy[]
}

export function thinkBot(view: BotView): { virtual: VirtualInput; rested: boolean } {
  let rested = view.rested
  const pressed: VirtualInput['pressed'] = []
  let fx = 0
  let fz = -1
  let ay = 1
  let ax = 0

  let nearest: BotEnemy | null = null
  let best = 14
  for (const enemy of view.enemies) {
    if (!enemy.alive) continue
    const d = Math.hypot(enemy.x - view.x, enemy.z - view.z)
    if (d < best) {
      best = d
      nearest = enemy
    }
  }

  const goal = objectiveTarget(view.step) ?? { x: LAYOUT.needle.x, z: LAYOUT.needle.z }
  if (nearest && best < 1.65 && nearest.winding) {
    fx = view.x - nearest.x
    fz = view.z - nearest.z
    ay = 1
    pressed.push('dodge')
  } else if (nearest && best < 2.05) {
    fx = nearest.x - view.x
    fz = nearest.z - view.z
    ay = best > 1.35 ? 1 : 0
    pressed.push(nearest.archetype === 'brute' && Math.sin(view.time * 2.2) > 0.65 ? 'heavy' : 'light')
  } else if (nearest && best < 12) {
    fx = nearest.x - view.x
    fz = nearest.z - view.z
    ay = 1
  } else {
    fx = goal.x - view.x
    fz = goal.z - view.z
    ay = Math.hypot(fx, fz) > 2 ? 1 : 0
  }

  if (view.step === 1 && !rested) {
    const d = Math.hypot(LAYOUT.stone.x - view.x, LAYOUT.stone.z - view.z)
    if (d < 2.5) {
      pressed.push('interact')
      rested = true
      ay = 0
    }
  }

  return {
    rested,
    virtual: {
      ax,
      ay,
      pressed,
      yaw: yawToward(fx, fz),
    },
  }
}
