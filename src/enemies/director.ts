import * as THREE from 'three'
import { overlaps, type Strike } from '../combat/hitbox.ts'
import { LAYOUT } from '../world/layout.ts'
import { Enemy, type EnemyTick, type Sense, type Spawn } from './enemy.ts'

export interface Bolt {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  damage: number
  swingId: number
  life: number
  mesh: THREE.Mesh
}

export const CAMP_SPAWNS: Spawn[] = [
  { id: 'path-stalker', archetype: 'stalker', x: -32, z: -1 },
  { id: 'thorn-1', archetype: 'stalker', x: -68, z: -1, camp: 'thorn' },
  { id: 'thorn-2', archetype: 'stalker', x: -75, z: 2, camp: 'thorn' },
  { id: 'thorn-3', archetype: 'stalker', x: -70, z: -5, camp: 'thorn' },
  { id: 'thorn-brute', archetype: 'brute', x: -73, z: 0.5, camp: 'thorn' },
  { id: 'vein-1', archetype: 'drone', x: 64, z: 5 },
  { id: 'vein-2', archetype: 'drone', x: 84, z: 7 },
  { id: 'vein-3', archetype: 'drone', x: 94, z: -3 },
]

export class EnemyDirector {
  readonly enemies: Enemy[] = []
  readonly bolts: Bolt[] = []
  readonly hadCamp: boolean
  private readonly group = new THREE.Group()

  constructor(parent: THREE.Object3D, defeated: ReadonlySet<string>, enabled: boolean, ground: (x: number, z: number) => number) {
    parent.add(this.group)
    const spawns = enabled ? CAMP_SPAWNS : []
    this.hadCamp = spawns.some((s) => s.camp === 'thorn' && !defeated.has(s.id))
    for (const spawn of spawns) {
      if (defeated.has(spawn.id)) continue
      const enemy = new Enemy(spawn, ground(spawn.x, spawn.z))
      this.enemies.push(enemy)
      this.group.add(enemy.visual.root)
    }
  }

  campRemaining(): number {
    return this.enemies.filter((e) => e.camp === 'thorn' && e.alive).length
  }

  living(): Enemy[] {
    return this.enemies.filter((e) => e.alive)
  }

  update(dt: number, time: number, sense: Omit<Sense, 'allies'>): { strikes: { enemy: Enemy; strike: Strike }[]; shots: number } {
    const allies = this.living().map((e) => ({ x: e.x, z: e.z, r: e.radius }))
    const strikes: { enemy: Enemy; strike: Strike }[] = []
    for (const enemy of this.enemies) {
      const tick: EnemyTick = enemy.update(dt, time, {
        ...sense,
        allies: allies.filter((a) => a.x !== enemy.x || a.z !== enemy.z),
      })
      if (tick.strike) strikes.push({ enemy, strike: tick.strike })
      if (tick.shot) this.spawnBolt(tick.shot)
    }
    this.updateBolts(dt, sense.ground)
    return { strikes, shots: this.bolts.length }
  }

  boltHits(px: number, py: number, pz: number, radius: number): Bolt | null {
    for (const bolt of this.bolts) {
      if (overlaps(bolt.x, bolt.y, bolt.z, 0.28, px, py + 1, pz, radius)) return bolt
    }
    return null
  }

  removeBolt(bolt: Bolt): void {
    const i = this.bolts.indexOf(bolt)
    if (i >= 0) this.bolts.splice(i, 1)
    bolt.mesh.removeFromParent()
  }

  resetLiving(): void {
    for (const enemy of this.enemies) enemy.resetLive()
    for (const bolt of this.bolts) bolt.mesh.removeFromParent()
    this.bolts.length = 0
  }

  destroy(): void {
    this.resetLiving()
    this.group.removeFromParent()
  }

  look(camera: THREE.Camera): void {
    for (const enemy of this.enemies) enemy.lookBar(camera)
  }

  private spawnBolt(shot: NonNullable<EnemyTick['shot']>): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#8ffff0', emissive: '#39f2e2', emissiveIntensity: 2, roughness: 0.3 }),
    )
    mesh.position.set(shot.x, shot.y, shot.z)
    this.group.add(mesh)
    this.bolts.push({ ...shot, life: 2.3, mesh })
  }

  private updateBolts(dt: number, ground: (x: number, z: number, feetY: number) => number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i]!
      bolt.life -= dt
      bolt.x += bolt.vx * dt
      bolt.y += bolt.vy * dt
      bolt.z += bolt.vz * dt
      bolt.mesh.position.set(bolt.x, bolt.y, bolt.z)
      const outside = Math.abs(bolt.x) > LAYOUT.limit || Math.abs(bolt.z) > LAYOUT.limit
      const buried = bolt.y < ground(bolt.x, bolt.z, bolt.y) + 0.2
      if (bolt.life <= 0 || outside || buried) {
        bolt.mesh.removeFromParent()
        this.bolts.splice(i, 1)
      }
    }
  }
}
