import * as THREE from 'three'
import { Vital } from '../combat/health.ts'
import { nextSwing, type Strike } from '../combat/hitbox.ts'
import { dampAngle, yawToward } from '../core/math.ts'
import { resolveCircle, type AABB } from '../physics/colliders.ts'
import { BODY_HEIGHT, BODY_RADIUS } from '../physics/character.ts'
import { buildEnemyMesh, type EnemyVisual } from './meshes.ts'

export type Archetype = 'stalker' | 'brute' | 'drone'

export interface Spawn {
  id: string
  archetype: Archetype
  x: number
  z: number
  camp?: string
}

interface Stats {
  hp: number
  poise: number
  speed: number
  aggro: number
  leash: number
  range: number
  damage: number
  wind: number
  active: number
  recover: number
  cooldown: number
  radius: number
  hitY: number
  hover: number
}

const STATS: Record<Archetype, Stats> = {
  stalker: {
    hp: 48,
    poise: 26,
    speed: 4.4,
    aggro: 11,
    leash: 18,
    range: 1.75,
    damage: 9,
    wind: 0.4,
    active: 0.16,
    recover: 0.48,
    cooldown: 0.65,
    radius: 0.48,
    hitY: 0.9,
    hover: 0,
  },
  brute: {
    hp: 125,
    poise: 58,
    speed: 2.3,
    aggro: 8.5,
    leash: 15,
    range: 2.25,
    damage: 18,
    wind: 0.7,
    active: 0.2,
    recover: 0.62,
    cooldown: 0.9,
    radius: 0.72,
    hitY: 1.25,
    hover: 0,
  },
  drone: {
    hp: 36,
    poise: 16,
    speed: 3.7,
    aggro: 15,
    leash: 22,
    range: 13,
    damage: 8,
    wind: 0.2,
    active: 0.1,
    recover: 0.2,
    cooldown: 2.15,
    radius: 0.46,
    hitY: 1.6,
    hover: 2.2,
  },
}

export interface EnemyTick {
  strike: Strike | null
  shot: { x: number; y: number; z: number; vx: number; vy: number; vz: number; damage: number; swingId: number } | null
}

export interface Sense {
  px: number
  py: number
  pz: number
  playerAlive: boolean
  heard: boolean
  blocks: readonly AABB[]
  ground: (x: number, z: number, feetY: number) => number
  water: (x: number, z: number) => number | null
  allies: { x: number; z: number; r: number }[]
}

type Phase = 'idle' | 'windup' | 'active' | 'recover'

export class Enemy {
  readonly id: string
  readonly archetype: Archetype
  readonly camp?: string
  readonly vital: Vital
  readonly homeX: number
  readonly homeZ: number
  readonly visual: EnemyVisual
  x: number
  y: number
  z: number
  yaw = 0
  aggro = false
  lastHurtBy = 0
  pushX = 0
  pushZ = 0
  private readonly stats: Stats
  private phase: Phase = 'idle'
  private phaseT = 0
  private cooldown = 0.4
  private swingId = 0
  private returning = false
  private deadT = 0
  private baseEmissive: number[] = []

  constructor(spawn: Spawn, groundY: number) {
    this.id = spawn.id
    this.archetype = spawn.archetype
    this.camp = spawn.camp
    this.stats = STATS[spawn.archetype]
    this.vital = new Vital(this.stats.hp, this.stats.poise)
    this.homeX = spawn.x
    this.homeZ = spawn.z
    this.x = spawn.x
    this.z = spawn.z
    this.y = groundY
    this.visual = buildEnemyMesh(spawn.archetype)
    this.baseEmissive = this.visual.materials.map((m) => m.emissiveIntensity)
    this.sync(0)
  }

  get alive(): boolean {
    return this.vital.alive
  }

  get radius(): number {
    return this.stats.radius
  }

  get hitY(): number {
    return this.y + this.stats.hitY
  }

  get winding(): boolean {
    return this.phase === 'windup' || this.phase === 'active'
  }

  update(dt: number, time: number, sense: Sense): EnemyTick {
    const empty: EnemyTick = { strike: null, shot: null }
    this.vital.update(dt)
    this.pushX *= Math.exp(-6 * dt)
    this.pushZ *= Math.exp(-6 * dt)
    if (!this.vital.alive) {
      this.deadT += dt
      const k = Math.min(1, this.deadT / 1.05)
      this.visual.root.rotation.x = Math.min(1.2, this.deadT * 1.6)
      this.visual.bob.scale.setScalar(Math.max(0.04, 1 - k * 0.92))
      this.y -= dt * 0.2
      for (const material of this.visual.materials) {
        material.transparent = true
        material.opacity = 1 - k
        material.emissive.set('#fff1c2')
        material.emissiveIntensity = 1.4 * (1 - k)
      }
      this.visual.root.visible = this.deadT < 1.15
      this.sync(time)
      return empty
    }

    const dx = sense.px - this.x
    const dz = sense.pz - this.z
    const dist = Math.hypot(dx, dz)
    const homeDist = Math.hypot(this.homeX - this.x, this.homeZ - this.z)

    if (this.vital.stagger > 0) {
      this.phase = 'idle'
      this.returning = false
      this.face(dt, dx, dz)
      this.slide(dt, 0, 0, sense)
      this.paint(time, true)
      this.sync(time)
      return empty
    }

    if (homeDist > this.stats.leash) this.returning = true
    if (this.returning) {
      this.aggro = false
      if (homeDist < 1.3) this.returning = false
      else if (homeDist < this.stats.leash * 0.5 && dist < this.stats.aggro * 0.8 && sense.playerAlive) {
        this.returning = false
        this.aggro = true
      } else {
        this.moveToward(dt, this.homeX - this.x, this.homeZ - this.z, this.stats.speed * 0.85, sense)
        this.paint(time, false)
        this.sync(time)
        return empty
      }
    }

    if (!this.aggro) {
      if (sense.playerAlive && (dist < this.stats.aggro || (sense.heard && dist < this.stats.aggro + 5))) this.aggro = true
      else {
        this.paint(time, false)
        this.sync(time)
        return empty
      }
    }

    if (!sense.playerAlive) {
      this.aggro = false
      this.paint(time, false)
      this.sync(time)
      return empty
    }

    this.face(dt, dx, dz)
    if (this.archetype === 'drone') {
      const shot = this.updateDrone(dt, dist, dx, dz, sense)
      this.paint(time, false)
      this.sync(time)
      return { strike: null, shot }
    }

    let strike: Strike | null = null
    if (this.phase !== 'idle') {
      this.phaseT += dt
      if (this.phase === 'windup' && this.phaseT >= this.stats.wind) {
        this.phase = 'active'
        this.phaseT = 0
        this.swingId = nextSwing()
      } else if (this.phase === 'active') {
        const fx = -Math.sin(this.yaw)
        const fz = -Math.cos(this.yaw)
        if (this.archetype === 'stalker') this.pushX += fx * dt * 18
        strike = {
          x: this.x + fx * (this.stats.range * 0.75),
          y: this.hitY,
          z: this.z + fz * (this.stats.range * 0.75),
          radius: this.archetype === 'brute' ? 1.15 : 0.85,
          damage: this.stats.damage,
          poise: this.archetype === 'brute' ? 30 : 12,
          knock: this.archetype === 'brute' ? 6 : 2.4,
          swingId: this.swingId,
          fromX: this.x,
          fromZ: this.z,
          team: 'enemy',
          heavy: this.archetype === 'brute',
        }
        if (this.phaseT >= this.stats.active) {
          this.phase = 'recover'
          this.phaseT = 0
        }
      } else if (this.phase === 'recover' && this.phaseT >= this.stats.recover) {
        this.phase = 'idle'
        this.cooldown = this.stats.cooldown
      }
      this.slide(dt, 0, 0, sense)
    } else {
      this.cooldown -= dt
      if (dist <= this.stats.range && this.cooldown <= 0) {
        this.phase = 'windup'
        this.phaseT = 0
      } else if (dist > this.stats.range * 0.75) {
        this.moveToward(dt, dx, dz, this.stats.speed, sense)
      } else this.slide(dt, 0, 0, sense)
    }

    this.separate(sense)
    this.paint(time, this.phase === 'windup' || this.phase === 'active')
    this.sync(time)
    return { strike, shot: null }
  }

  hurt(strike: Strike): 'none' | 'hit' | 'stagger' | 'dead' {
    if (!this.alive || strike.swingId === this.lastHurtBy) return 'none'
    this.lastHurtBy = strike.swingId
    const result = this.vital.hurt(strike.damage, strike.poise, 0.08, 0.85)
    if (result === 'none') return 'none'
    this.aggro = true
    const k = result === 'stagger' ? strike.knock * 1.3 : strike.knock
    this.pushX += (this.x - strike.fromX) * k
    this.pushZ += (this.z - strike.fromZ) * k
    this.visual.bar.visible = true
    this.visual.bar.scale.x = Math.max(0.05, this.vital.hp / this.vital.max)
    this.visual.bar.position.x = (this.visual.bar.scale.x - 1) * 0.43
    return result
  }

  stagger(seconds: number): void {
    this.vital.stagger = Math.max(this.vital.stagger, seconds)
    this.phase = 'idle'
    this.cooldown = 0.5
  }

  resetLive(): void {
    if (!this.alive) return
    this.x = this.homeX
    this.z = this.homeZ
    this.aggro = false
    this.phase = 'idle'
    this.returning = false
    this.pushX = 0
    this.pushZ = 0
    this.vital.stagger = 0
  }

  private updateDrone(dt: number, dist: number, dx: number, dz: number, sense: Sense): EnemyTick['shot'] {
    let mx = 0
    let mz = 0
    if (dist > 8.5) {
      mx = dx
      mz = dz
    } else if (dist < 4.5) {
      mx = -dx
      mz = -dz
    } else {
      mx = -dz
      mz = dx
    }
    this.moveToward(dt, mx, mz, this.stats.speed, sense, true)
    this.cooldown -= dt
    if (this.cooldown > 0 || dist > 14 || dist < 3.2) return null
    this.cooldown = this.stats.cooldown
    const sx = this.x
    const sy = this.y + 0.35
    const sz = this.z
    const tx = sense.px - sx
    const ty = sense.py + 1.05 - sy
    const tz = sense.pz - sz
    const len = Math.hypot(tx, ty, tz) || 1
    const speed = 10
    return {
      x: sx,
      y: sy,
      z: sz,
      vx: (tx / len) * speed,
      vy: (ty / len) * speed,
      vz: (tz / len) * speed,
      damage: this.stats.damage,
      swingId: nextSwing(),
    }
  }

  private moveToward(dt: number, dx: number, dz: number, speed: number, sense: Sense, hover = false): void {
    this.face(dt, dx, dz)
    const len = Math.hypot(dx, dz) || 1
    this.slide(dt, (dx / len) * speed, (dz / len) * speed, sense, hover)
  }

  private slide(dt: number, vx: number, vz: number, sense: Sense, hover = false): void {
    const nx = this.x + (vx + this.pushX) * dt
    const nz = this.z + (vz + this.pushZ) * dt
    const resolved = resolveCircle(nx, nz, this.stats.radius, this.y, hover ? 0.8 : 1.4, 0.5, sense.blocks)
    this.x = resolved.x
    this.z = resolved.z
    const floor = sense.ground(this.x, this.z, this.y)
    const surface = sense.water(this.x, this.z)
    if (this.stats.hover > 0) {
      const base = surface !== null && surface > floor ? surface : floor
      const target = base + this.stats.hover
      this.y += (target - this.y) * Math.min(1, dt * 4)
    } else if (surface !== null && surface - floor > 0.8) {
      const target = surface - 0.25
      this.y += (target - this.y) * Math.min(1, dt * 4)
    } else {
      this.y = floor
    }
  }

  private separate(sense: Sense): void {
    for (const ally of sense.allies) {
      const dx = this.x - ally.x
      const dz = this.z - ally.z
      const d = Math.hypot(dx, dz)
      const need = this.stats.radius + ally.r
      if (d > 0.001 && d < need) {
        this.x += (dx / d) * (need - d) * 0.5
        this.z += (dz / d) * (need - d) * 0.5
      }
    }
    const pdx = this.x - sense.px
    const pdz = this.z - sense.pz
    const pd = Math.hypot(pdx, pdz)
    const gap = this.stats.radius + BODY_RADIUS * 0.85
    if (pd > 0.001 && pd < gap && Math.abs(this.y - sense.py) < BODY_HEIGHT) {
      this.x += (pdx / pd) * (gap - pd)
      this.z += (pdz / pd) * (gap - pd)
    }
  }

  private face(dt: number, dx: number, dz: number): void {
    if (Math.hypot(dx, dz) < 0.05) return
    this.yaw = dampAngle(this.yaw, yawToward(dx, dz), 8, dt)
  }

  private paint(time: number, hot: boolean): void {
    this.visual.materials.forEach((material, i) => {
      const base = this.baseEmissive[i] ?? 1
      material.emissiveIntensity = hot ? base + 0.8 + Math.sin(time * 18) * 0.3 : base
      if (hot) material.emissive.set('#ffb090')
      else if (this.archetype === 'drone') material.emissive.set(i === 0 ? '#0c2e32' : i === 1 ? '#39f2e2' : '#ff4d8d')
      else if (this.archetype === 'stalker' && i === 2) material.emissive.set('#ff5a3c')
      else material.emissive.set('#000000')
    })
  }

  private sync(time: number): void {
    this.visual.root.position.set(this.x, this.y, this.z)
    this.visual.root.rotation.y = this.yaw
    if (this.alive) {
      if (this.phase === 'windup') this.visual.bob.scale.set(0.9, 1.14, 0.9)
      else if (this.phase === 'active') this.visual.bob.scale.set(1.16, 0.76, 1.16)
      else this.visual.bob.scale.set(1, 1, 1)
    }
    if (this.archetype === 'drone' && this.alive) {
      this.visual.bob.position.y = Math.sin(time * 3 + this.homeX) * 0.12
      this.visual.bob.rotation.y = time * 1.4
    }
    const bar = this.visual.bar.parent
    if (bar) bar.visible = this.alive && this.visual.bar.visible
  }

  lookBar(camera: THREE.Camera): void {
    const host = this.visual.bar.parent
    if (host) host.lookAt(camera.position)
  }
}
