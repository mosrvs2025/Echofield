import { nextSwing, type Strike } from '../combat/hitbox.ts'

type Phase = 'idle' | 'windup' | 'active' | 'recover'
type Kind = 'light' | 'heavy'

interface Spec {
  wind: number
  active: number
  recover: number
  damage: number
  poise: number
  knock: number
  range: number
  radius: number
}

const LIGHTS: Spec[] = [
  { wind: 0.12, active: 0.14, recover: 0.16, damage: 13, poise: 12, knock: 2.2, range: 1.25, radius: 0.9 },
  { wind: 0.1, active: 0.14, recover: 0.16, damage: 15, poise: 14, knock: 2.6, range: 1.32, radius: 0.95 },
  { wind: 0.14, active: 0.18, recover: 0.28, damage: 24, poise: 22, knock: 4.4, range: 1.5, radius: 1.05 },
]

const HEAVY: Spec = {
  wind: 0.32,
  active: 0.16,
  recover: 0.38,
  damage: 36,
  poise: 48,
  knock: 7.5,
  range: 1.6,
  radius: 1.2,
}

export class CombatMoves {
  phase: Phase = 'idle'
  kind: Kind | null = null
  chain = 0
  t = 0
  swingId = 0
  dodge = 0
  iframes = 0
  parry = 0
  private buffer: Kind | null = null
  private spec: Spec | null = null

  get attacking(): boolean {
    return this.phase !== 'idle'
  }

  /** Returns stamina cost, 0 if ignored, -1 if the body is winded. */
  tryLight(stamina: number): number {
    if (this.dodge > 0.08) return 0
    if (this.phase === 'idle') {
      if (stamina < 6) return -1
      this.start('light', 0)
      return 8
    }
    if (this.kind === 'light' && this.chain < 2 && (this.phase === 'active' || this.phase === 'recover')) {
      this.buffer = 'light'
    }
    return 0
  }

  tryHeavy(stamina: number): number {
    if (this.dodge > 0.08) return 0
    if (this.phase === 'idle') {
      if (stamina < 18) return -1
      this.start('heavy', 0)
      return 22
    }
    if (this.phase === 'recover') this.buffer = 'heavy'
    return 0
  }

  tryDodge(stamina: number, swimming: boolean): number {
    if (swimming || this.dodge > 0) return 0
    if (stamina < 20) return -1
    this.phase = 'idle'
    this.kind = null
    this.spec = null
    this.buffer = null
    this.dodge = 0.42
    this.iframes = 0.28
    return 24
  }

  tryParry(stamina: number, swimming: boolean): number {
    if (swimming || this.dodge > 0 || this.phase === 'windup' || this.phase === 'active') return 0
    if (stamina < 8) return -1
    this.parry = 0.28
    this.phase = 'idle'
    this.kind = null
    this.spec = null
    return 8
  }

  update(dt: number): void {
    if (this.dodge > 0) this.dodge = Math.max(0, this.dodge - dt)
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - dt)
    if (this.parry > 0) this.parry = Math.max(0, this.parry - dt)
    if (!this.spec || this.phase === 'idle') return
    this.t += dt
    const spec = this.spec
    if (this.phase === 'windup' && this.t >= spec.wind) {
      this.phase = 'active'
      this.t = 0
    } else if (this.phase === 'active' && this.t >= spec.active) {
      this.phase = 'recover'
      this.t = 0
    } else if (this.phase === 'recover' && this.t >= spec.recover) {
      if (this.buffer === 'light' && this.kind === 'light' && this.chain < 2) this.start('light', this.chain + 1)
      else if (this.buffer === 'heavy') this.start('heavy', 0)
      else this.clear()
    }
  }

  strike(x: number, y: number, z: number, facing: number): Strike | null {
    if (this.phase !== 'active' || !this.spec) return null
    const fx = -Math.sin(facing)
    const fz = -Math.cos(facing)
    return {
      x: x + fx * this.spec.range,
      y: y + 1.05,
      z: z + fz * this.spec.range,
      radius: this.spec.radius,
      damage: this.spec.damage,
      poise: this.spec.poise,
      knock: this.spec.knock,
      swingId: this.swingId,
      fromX: x,
      fromZ: z,
      team: 'player',
      heavy: this.kind === 'heavy',
    }
  }

  private start(kind: Kind, chain: number): void {
    this.kind = kind
    this.chain = chain
    this.phase = 'windup'
    this.t = 0
    this.spec = kind === 'heavy' ? HEAVY : LIGHTS[chain] ?? LIGHTS[0]
    this.swingId = nextSwing()
    this.buffer = null
  }

  private clear(): void {
    this.phase = 'idle'
    this.kind = null
    this.spec = null
    this.buffer = null
    this.t = 0
  }
}
