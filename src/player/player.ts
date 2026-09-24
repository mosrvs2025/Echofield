import { Vital } from '../combat/health.ts'
import type { Strike } from '../combat/hitbox.ts'
import { dampAngle, yawToward } from '../core/math.ts'
import { createBody, shove, stepCharacter, type Body, type Probe } from '../physics/character.ts'
import { animateAvatar, buildAvatar, type Avatar } from './avatar.ts'
import { CombatMoves } from './combat.ts'

export interface PlayerInput {
  wishX: number
  wishZ: number
  speedHeld: boolean
  jump: boolean
  light: boolean
  heavy: boolean
  dodge: boolean
  parry: boolean
  cameraYaw: number
  locked: boolean
  lockX: number
  lockZ: number
}

export class Player {
  readonly body: Body
  readonly vital = new Vital(100, 40)
  readonly combat = new CombatMoves()
  readonly avatar: Avatar
  stamina = 100
  readonly staminaMax = 100
  facing = 0
  god = false
  downed = false
  deathT = 0
  lastHurtBy = 0
  winded = 0
  private regenDelay = 0
  private sprinting = false
  private jumpBuffer = 0
  private dodgeX = 0
  private dodgeZ = -1

  constructor(x: number, z: number, y: number) {
    this.body = createBody(x, z, y)
    this.avatar = buildAvatar()
    this.avatar.root.position.set(x, y, z)
  }

  get alive(): boolean {
    return this.vital.alive && !this.downed
  }

  update(dt: number, input: PlayerInput, probe: Probe, time: number): void {
    this.vital.update(dt)
    this.winded = Math.max(0, this.winded - dt)
    if (this.downed) {
      this.deathT -= dt
      animateAvatar(this.avatar, time, 0, false, false, this.combat, true)
      this.syncMesh()
      return
    }

    if (input.jump) this.jumpBuffer = 0.12
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)

    const swimming = this.body.swimming
    let speed = 5.5
    const moving = Math.hypot(input.wishX, input.wishZ) > 0.1
    if (input.speedHeld && moving && this.body.grounded && !this.combat.attacking && this.combat.dodge <= 0) {
      if (this.stamina > (this.sprinting ? 0 : 8) || this.god) {
        this.sprinting = true
        speed = 9.1
        this.spend(22 * dt)
      } else this.sprinting = false
    } else this.sprinting = false

    if (this.body.depth > 0.3 && !swimming) speed *= 0.72
    if (swimming) speed = this.sprinting ? 6.2 : 4.6
    if (this.combat.attacking) speed *= this.combat.phase === 'recover' ? 0.65 : 0.32
    if (this.vital.stagger > 0) speed *= 0.25

    let wishX = input.wishX
    let wishZ = input.wishZ

    if (!swimming && this.combat.dodge <= 0) {
      const heavyCost = input.heavy ? this.combat.tryHeavy(this.god ? 99 : this.stamina) : 0
      const lightCost = input.light ? this.combat.tryLight(this.god ? 99 : this.stamina) : 0
      const parryCost = input.parry ? this.combat.tryParry(this.god ? 99 : this.stamina, swimming) : 0
      this.applyCost(heavyCost)
      this.applyCost(lightCost)
      this.applyCost(parryCost)
    } else if (input.light || input.heavy || input.parry) {
      this.winded = Math.max(this.winded, 0.2)
    }

    if (input.dodge && this.combat.dodge <= 0) {
      const back = Math.hypot(wishX, wishZ) < 0.2
      const dx = back ? Math.sin(input.cameraYaw) : wishX
      const dz = back ? Math.cos(input.cameraYaw) : wishZ
      const cost = this.combat.tryDodge(this.god ? 99 : this.stamina, swimming)
      if (cost > 0) {
        const len = Math.hypot(dx, dz) || 1
        this.dodgeX = dx / len
        this.dodgeZ = dz / len
      }
      this.applyCost(cost)
    }
    if (this.combat.dodge > 0.05) {
      wishX = this.dodgeX
      wishZ = this.dodgeZ
      speed = 13
    }

    const jump = this.jumpBuffer > 0 && (this.god || this.stamina >= 10) && this.combat.dodge <= 0
    const beforeY = this.body.vy
    stepCharacter(this.body, { wishX, wishZ, speed, jump }, probe, dt)
    if (jump && this.body.vy > beforeY && this.body.vy > 4) {
      this.jumpBuffer = 0
      if (!this.god) this.spend(12)
    }

    this.combat.update(dt)
    this.face(dt, input, wishX, wishZ, moving)
    if (this.regenDelay > 0) this.regenDelay -= dt
    else if (!this.sprinting) this.stamina = Math.min(this.staminaMax, this.stamina + dt * 28)
    if (this.god) {
      this.stamina = this.staminaMax
      this.vital.hp = this.vital.max
    }

    animateAvatar(
      this.avatar,
      time,
      moving ? speed : 0,
      this.body.swimming,
      this.combat.dodge > 0,
      this.combat,
      false,
    )
    if (this.vital.invuln > 0 || this.combat.iframes > 0) {
      this.avatar.visual.visible = Math.sin(time * 40) > 0
    } else this.avatar.visual.visible = true
    this.syncMesh()
  }

  strike(): Strike | null {
    if (this.downed) return null
    return this.combat.strike(this.body.x, this.body.y, this.body.z, this.facing)
  }

  receive(strike: Strike): 'none' | 'hit' | 'stagger' | 'dead' | 'parry' {
    if (this.downed || this.god) return 'none'
    if (strike.swingId === this.lastHurtBy) return 'none'
    if (this.combat.iframes > 0 || this.vital.invuln > 0) {
      this.lastHurtBy = strike.swingId
      return 'none'
    }
    if (this.combat.parry > 0) {
      this.lastHurtBy = strike.swingId
      this.combat.parry = 0
      this.stamina = Math.min(this.staminaMax, this.stamina + 12)
      return 'parry'
    }
    this.lastHurtBy = strike.swingId
    const result = this.vital.hurt(strike.damage, strike.poise, 0.42, strike.heavy ? 0.45 : 0.2)
    if (result === 'none') return 'none'
    shove(this.body, this.body.x - strike.fromX, this.body.z - strike.fromZ, strike.knock * 1.4)
    if (result === 'dead') {
      this.downed = true
      this.deathT = 1.25
    }
    return result
  }

  revive(x: number, z: number, y: number): void {
    this.body.x = x
    this.body.y = y
    this.body.z = z
    this.body.vx = 0
    this.body.vy = 0
    this.body.vz = 0
    this.body.pushX = 0
    this.body.pushZ = 0
    this.body.swimming = false
    this.vital.refill()
    this.vital.invuln = 1.5
    this.stamina = this.staminaMax
    this.downed = false
    this.deathT = 0
    this.avatar.visual.visible = true
    this.syncMesh()
  }

  private face(dt: number, input: PlayerInput, wishX: number, wishZ: number, moving: boolean): void {
    let target = this.facing
    if (input.locked) target = yawToward(input.lockX - this.body.x, input.lockZ - this.body.z)
    else if (this.combat.attacking || this.combat.parry > 0) target = input.cameraYaw
    else if (moving) target = yawToward(wishX, wishZ)
    this.facing = dampAngle(this.facing, target, 12, dt)
  }

  private applyCost(cost: number): void {
    if (cost > 0) this.spend(cost)
    else if (cost < 0) this.winded = 0.35
  }

  private spend(amount: number): void {
    if (this.god) return
    this.stamina = Math.max(0, this.stamina - amount)
    this.regenDelay = 0.55
  }

  private syncMesh(): void {
    this.avatar.root.position.set(this.body.x, this.body.y, this.body.z)
    this.avatar.root.rotation.y = this.facing
  }
}
