import * as THREE from 'three'
import { AudioBus } from '../audio/audio.ts'
import { overlaps, type Strike } from '../combat/hitbox.ts'
import { Emitter, type GameEvents } from '../core/events.ts'
import { Input, prefersTouchLook } from '../core/input.ts'
import { loadSettings, saveSettings, type Quality, type Settings } from '../core/settings.ts'
import { Time } from '../core/time.ts'
import { EnemyDirector } from '../enemies/director.ts'
import type { Enemy } from '../enemies/enemy.ts'
import { FX } from '../fx/fx.ts'
import { Post } from '../fx/post.ts'
import { thinkBot } from '../gameplay/bot.ts'
import {
  loadSave,
  objectiveTarget,
  objectiveText,
  onCampCleared,
  onNeedle,
  onSeamstone,
  writeSave,
  type Checkpoint,
  type ObjectiveStep,
} from '../gameplay/session.ts'
import { BODY_RADIUS } from '../physics/character.ts'
import { groundTop } from '../physics/colliders.ts'
import { terrainHeight, waterSurface } from '../physics/heightfield.ts'
import { CameraRig } from '../player/camera.ts'
import { Player } from '../player/player.ts'
import { UI, type HudView } from '../ui/ui.ts'
import { areaName, type BiomeId } from '../world/biomes.ts'
import { LAYOUT } from '../world/layout.ts'
import { World } from '../world/world.ts'

export interface Flags {
  god: boolean
  noenemies: boolean
  skip: boolean
  bot: boolean
  quality: Quality | null
  at: 'lake' | 'camp' | 'needle' | 'fen' | 'glass' | 'verdant' | null
  step: ObjectiveStep | null
}

const SPAWN: Checkpoint = { x: LAYOUT.spawn.x, y: LAYOUT.hub.h, z: LAYOUT.spawn.z, label: 'Crosscamp' }

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly post: Post
  private readonly blob: THREE.Mesh
  private readonly clock = new THREE.Clock()
  private readonly time = new Time()
  private readonly input: Input
  private readonly settings: Settings
  private readonly events = new Emitter<GameEvents>()
  private readonly audio: AudioBus
  private readonly ui: UI
  private readonly fx: FX
  private readonly rig = new CameraRig()
  private world: World
  private player: Player
  private enemies: EnemyDirector
  private mode: 'title' | 'play' | 'pause' | 'map' | 'dialogue' = 'title'
  private step: ObjectiveStep = 0
  private checkpoint: Checkpoint = { ...SPAWN }
  private defeated = new Set<string>()
  private lock: Enemy | null = null
  private area: BiomeId | null = null
  private hintT = 12
  private realT = 0
  private needleArm = true
  private needleTold = false
  private botRested = false
  private showDebug = false
  private fps = 0
  private fpsAccum = 0
  private fpsFrames = 0
  private heardSwing = 0
  private running = false
  private dustT = 0.2
  private trailT = 0

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, flags: Flags) {
    this.settings = loadSettings()
    if (flags.quality) this.settings.quality = flags.quality
    else if (preferLowOnPhone()) this.settings.quality = 'low'
    saveSettings(this.settings)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.AgXToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = this.settings.quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500)
    this.post = new Post(this.renderer, this.scene, this.camera, this.settings.quality)
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 24),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            float d = length(vUv * 2.0 - 1.0);
            float a = smoothstep(1.0, 0.18, d) * 0.48;
            gl_FragColor = vec4(0.05, 0.035, 0.02, a);
          }
        `,
      }),
    )
    this.blob.rotation.x = -Math.PI / 2
    this.blob.renderOrder = 1
    this.scene.add(this.blob)
    this.applySize()

    this.input = new Input(canvas)
    this.input.attach()
    this.audio = new AudioBus(this.events)
    this.audio.attach()
    this.ui = new UI(overlay, this.settings, {
      begin: () => this.start(false),
      continue: () => this.start(true),
      resume: () => this.resume(),
      quit: () => this.quit(),
      quality: (q) => this.setQuality(q),
      sensitivity: () => saveSettings(this.settings),
      volume: (v) => {
        saveSettings(this.settings)
        this.audio.setVolume(v)
      },
      shake: () => saveSettings(this.settings),
    })
    this.ui.mountTouch(this.input)
    this.fx = new FX(this.scene)
    this.world = new World(this.scene, this.settings.quality)
    const y = this.ground(SPAWN.x, SPAWN.z, SPAWN.y)
    this.player = new Player(SPAWN.x, SPAWN.z, y)
    this.player.god = flags.god
    this.scene.add(this.player.avatar.root)
    this.enemies = new EnemyDirector(this.scene, this.defeated, !flags.noenemies, (x, z) => terrainHeight(x, z))
    this.flags = flags
    window.addEventListener('resize', () => {
      this.applySize()
      if (prefersTouchLook()) this.input.exitLock()
    })
  }

  private flags: Flags

  async init(): Promise<void> {
    this.ui.boot('Raising Crosscamp…')
    await frame()
    this.ui.boot('Seeding the Verdant Rift…')
    await frame()
    this.ui.boot('Listening for the Neon Vein…')
    await frame()
    const save = loadSave()
    this.ui.showTitle(save !== null)
    this.running = true
    this.clock.getDelta()
    this.loop()
    if (this.flags.skip) this.start(false)
  }

  private start(useSave: boolean): void {
    const save = useSave ? loadSave() : null
    if (save) {
      this.step = save.objective
      this.checkpoint = save.checkpoint
      this.defeated = new Set(save.defeated)
    } else {
      this.step = this.flags.step ?? 0
      this.checkpoint = this.spawnFromFlag()
      this.defeated = new Set()
    }
    this.needleArm = true
    this.needleTold = false
    this.botRested = this.step > 1
    this.hintT = 14
    this.respawnEnemies()
    const y = this.ground(this.checkpoint.x, this.checkpoint.z, this.checkpoint.y)
    this.player.revive(this.checkpoint.x, this.checkpoint.z, y)
    this.player.god = this.flags.god
    this.mode = 'play'
    this.ui.setScreen('play')
    this.audio.resume(this.settings.volume)
    this.input.requestLock()
    this.events.emit('objective', { step: this.step, text: this.objectiveLine() })
  }

  private spawnFromFlag(): Checkpoint {
    if (this.flags.at === 'lake') return { x: LAYOUT.lake.x, y: 6, z: LAYOUT.lake.z, label: 'Rift lake' }
    if (this.flags.at === 'camp') return { x: LAYOUT.camp.x + 8, y: LAYOUT.camp.h, z: LAYOUT.camp.z, label: 'Thorn Camp' }
    if (this.flags.at === 'needle') return { x: LAYOUT.needle.x - 10, y: LAYOUT.needle.h, z: LAYOUT.needle.z, label: 'Chrome Needle' }
    if (this.flags.at === 'fen') return { x: LAYOUT.boneArch.x + 6, y: 8, z: LAYOUT.boneArch.z + 8, label: 'Bone Fen' }
    if (this.flags.at === 'glass') return { x: LAYOUT.saltSpire.x, y: 8, z: LAYOUT.saltSpire.z - 8, label: 'Glass Expanse' }
    if (this.flags.at === 'verdant') return { x: -58, y: 8, z: 8, label: 'Verdant Rift' }
    return { ...SPAWN }
  }

  private resume(): void {
    this.mode = 'play'
    this.ui.setScreen('play')
    this.input.requestLock()
  }

  private quit(): void {
    this.mode = 'title'
    this.lock = null
    this.input.exitLock()
    this.input.virtual = null
    if (this.player.downed) {
      const y = this.ground(this.checkpoint.x, this.checkpoint.z, this.checkpoint.y)
      this.player.revive(this.checkpoint.x, this.checkpoint.z, y)
    }
    this.ui.showTitle(loadSave() !== null)
  }

  private pause(): void {
    this.mode = 'pause'
    this.input.exitLock()
    this.ui.setScreen('pause')
  }

  private loop = (): void => {
    if (!this.running) return
    requestAnimationFrame(this.loop)
    const real = this.clock.getDelta()
    this.realT += real
    this.fpsAccum += real
    this.fpsFrames += 1
    if (this.fpsAccum >= 0.4) {
      this.fps = this.fpsFrames / this.fpsAccum
      this.fpsAccum = 0
      this.fpsFrames = 0
    }

    if (this.mode === 'title') {
      this.input.sample()
      this.input.endFrame()
      const ang = this.realT * 0.12
      this.camera.position.set(Math.sin(ang) * 16, 8.4, Math.cos(ang) * 16)
      this.camera.lookAt(0, 3.2, 0)
      this.blob.visible = false
      this.world.update(this.realT, 0, 0, false, this.camera.position)
      this.present(real)
      return
    }

    this.input.virtual = null
    if (this.mode === 'play' && this.flags.bot && !this.player.downed) {
      const thought = thinkBot({
        x: this.player.body.x,
        z: this.player.body.z,
        step: this.step,
        time: this.realT,
        rested: this.botRested,
        enemies: this.enemies.living().map((e) => ({
          x: e.x,
          z: e.z,
          alive: e.alive,
          winding: e.winding,
          archetype: e.archetype,
        })),
      })
      this.botRested = thought.rested
      this.input.virtual = thought.virtual
      this.rig.yaw = thought.virtual.yaw ?? this.rig.yaw
    }
    this.input.sample()
    this.handleMenus()

    const dt = this.mode === 'play' ? this.time.tick(real) : 0
    if (this.mode === 'play') this.simulate(dt)
    this.world.update(this.realT, this.player.body.x, this.player.body.z, this.player.body.swimming, this.camera.position)
    if (this.mode === 'play' || this.mode === 'pause' || this.mode === 'map' || this.mode === 'dialogue') {
      const lockPoint = this.lock && this.lock.alive ? { x: this.lock.x, y: this.lock.hitY, z: this.lock.z } : null
      if (!(this.flags.bot && this.input.virtual)) {
        this.rig.lateUpdate(
          this.camera,
          Math.max(real, 0.001),
          this.player.body.x,
          this.player.body.y,
          this.player.body.z,
          this.input.lookX,
          this.input.lookY,
          this.input.lookStickX,
          this.input.lookStickY,
          this.settings.sensitivity,
          this.mode === 'play' ? lockPoint : null,
          this.settings.shake,
        )
      } else {
        this.rig.lateUpdate(
          this.camera,
          Math.max(real, 0.001),
          this.player.body.x,
          this.player.body.y,
          this.player.body.z,
          0,
          0,
          0,
          0,
          this.settings.sensitivity,
          null,
          this.settings.shake,
        )
      }
    }
    this.enemies.look(this.camera)
    this.present(real)
    this.paintHud(real)
    this.input.endFrame()
  }

  private handleMenus(): void {
    if (this.mode === 'dialogue' && this.input.just('interact')) {
      this.backToPlay()
      return
    }
    if (this.input.just('debug')) this.showDebug = !this.showDebug
    if (this.input.just('pause')) {
      if (this.mode === 'play') this.pause()
      else if (this.mode === 'pause') this.resume()
      else if (this.mode === 'map' || this.mode === 'dialogue') this.backToPlay()
      return
    }
    if (this.input.just('map')) {
      if (this.mode === 'play') {
        this.mode = 'map'
        this.input.exitLock()
        this.ui.drawMap({ x: this.player.body.x, z: this.player.body.z }, this.step)
        this.ui.setScreen('map')
      } else if (this.mode === 'map') this.backToPlay()
    }
  }

  private backToPlay(): void {
    this.mode = 'play'
    this.ui.setScreen('play')
    this.input.requestLock()
  }

  private simulate(dt: number): void {
    if (this.player.downed && this.player.deathT <= 0) {
      this.respawn()
      return
    }

    const yaw = this.rig.yaw
    const lookX = -Math.sin(yaw)
    const lookZ = -Math.cos(yaw)
    const rightX = Math.cos(yaw)
    const rightZ = -Math.sin(yaw)
    const wishX = rightX * this.input.axisX + lookX * this.input.axisY
    const wishZ = rightZ * this.input.axisX + lookZ * this.input.axisY

    this.trackLock()
    const locked = this.lock !== null
    this.player.update(
      dt,
      {
        wishX,
        wishZ,
        speedHeld: this.input.sprint,
        jump: this.input.just('jump'),
        light: this.input.just('light'),
        heavy: this.input.just('heavy'),
        dodge: this.input.just('dodge'),
        parry: this.input.just('parry'),
        cameraYaw: yaw,
        locked,
        lockX: this.lock?.x ?? 0,
        lockZ: this.lock?.z ?? 0,
      },
      this.probe(),
      this.realT,
    )

    const speed = Math.hypot(this.player.body.vx, this.player.body.vz)
    this.blob.position.set(this.player.body.x, this.player.body.y + 0.05, this.player.body.z)
    this.blob.visible = !this.player.body.swimming && !this.player.downed
    this.blob.scale.setScalar(this.player.body.grounded ? 1 : 0.55)
    if (this.player.body.enteredWater) {
      this.events.emit('splash', {})
      this.fx.splash(this.player.body.x, waterSurface(this.player.body.x, this.player.body.z) ?? this.player.body.y, this.player.body.z)
    }
    if (this.player.body.grounded && !this.player.body.swimming && speed > 2.2 && !this.player.downed) {
      this.dustT -= dt
      if (this.dustT <= 0) {
        this.dustT = speed > 7 ? 0.09 : 0.18
        this.fx.dust(this.player.body.x, this.player.body.y, this.player.body.z)
      }
    }
    if (this.player.body.landedHard) {
      this.rig.addShake(0.25)
      this.fx.dust(this.player.body.x, this.player.body.y, this.player.body.z)
    }
    if (this.player.combat.dodge > 0.08) {
      this.trailT -= dt
      if (this.trailT <= 0) {
        this.trailT = 0.04
        this.fx.trail(this.player.body.x, this.player.body.y + 0.9, this.player.body.z)
      }
    }

    if (this.player.combat.phase === 'active' && this.player.combat.swingId !== this.heardSwing) {
      this.heardSwing = this.player.combat.swingId
      this.events.emit('swing', { heavy: this.player.combat.kind === 'heavy' })
    }

    if (!this.player.downed) {
      this.resolvePlayerStrike()
      this.resolveEnemyStrikes(dt)
      this.resolveBolts()
      this.touchObjectives()
      this.touchInteract()
    }

    if (Math.hypot(this.player.body.x, this.player.body.z) < 16 && Math.random() < dt * 4) {
      this.fx.burst(0.2, this.ground(0, 0, 3) + 0.6, 0.1, '#ff9a4a', 1, 1.2)
    }

    const biome = this.world.biomeAt(this.player.body.x, this.player.body.z)
    if (biome !== this.area) {
      if (this.area) this.ui.pushToast(areaName(biome))
      this.area = biome
      this.audio.setBiome(biome)
    }
  }

  private resolvePlayerStrike(): void {
    const strike = this.player.strike()
    if (!strike) return
    for (const enemy of this.enemies.living()) {
      if (!overlaps(strike.x, strike.y, strike.z, strike.radius, enemy.x, enemy.hitY, enemy.z, enemy.radius)) continue
      const result = enemy.hurt(strike)
      if (result === 'none') continue
      this.fx.impact(enemy.x, enemy.hitY, enemy.z)
      if (result === 'dead') this.fx.burst(enemy.x, enemy.hitY, enemy.z, '#f2d48a', 12, 4.5)
      this.rig.addShake(strike.heavy ? 0.4 : 0.16)
      if (strike.heavy || result === 'stagger') this.time.punch(strike.heavy ? 0.06 : 0.04)
      if (result === 'dead') this.onDefeat(enemy)
      else this.events.emit('hurt', { who: 'enemy', heavy: strike.heavy })
    }
  }

  private resolveEnemyStrikes(dt: number): void {
    const heard = this.player.combat.phase === 'active'
    const tick = this.enemies.update(dt, this.realT, {
      px: this.player.body.x,
      py: this.player.body.y,
      pz: this.player.body.z,
      playerAlive: !this.player.downed,
      heard,
      blocks: this.world.blocks,
      ground: (x, z, feet) => this.ground(x, z, feet),
      water: waterSurface,
    })
    for (const { enemy, strike } of tick.strikes) {
      if (this.player.downed) break
      if (!overlaps(strike.x, strike.y, strike.z, strike.radius, this.player.body.x, this.player.body.y + 1, this.player.body.z, BODY_RADIUS)) {
        continue
      }
      this.applyHitToPlayer(strike, enemy)
    }
  }

  private resolveBolts(): void {
    const bolt = this.enemies.boltHits(this.player.body.x, this.player.body.y, this.player.body.z, BODY_RADIUS + 0.1)
    if (!bolt || this.player.downed) return
    const strike: Strike = {
      x: bolt.x,
      y: bolt.y,
      z: bolt.z,
      radius: 0.3,
      damage: bolt.damage,
      poise: 8,
      knock: 2,
      swingId: bolt.swingId,
      fromX: bolt.x - bolt.vx,
      fromZ: bolt.z - bolt.vz,
      team: 'enemy',
      heavy: false,
    }
    this.applyHitToPlayer(strike, null)
    this.enemies.removeBolt(bolt)
  }

  private applyHitToPlayer(strike: Strike, enemy: Enemy | null): void {
    const result = this.player.receive(strike)
    if (result === 'parry') {
      enemy?.stagger(1.05)
      this.events.emit('parry', {})
      this.time.punch(0.05)
      this.rig.addShake(0.2)
      this.fx.flash(this.player.body.x, this.player.body.y + 1.1, this.player.body.z)
      return
    }
    if (result === 'hit' || result === 'stagger' || result === 'dead') {
      this.events.emit('hurt', { who: 'player', heavy: strike.heavy })
      this.ui.flashHurt()
      this.rig.addShake(strike.heavy ? 0.55 : 0.3)
      this.time.punch(0.045)
      this.fx.impact(this.player.body.x, this.player.body.y + 1, this.player.body.z)
    }
  }

  private onDefeat(enemy: Enemy): void {
    this.defeated.add(enemy.id)
    this.events.emit('defeat', { id: enemy.id, archetype: enemy.archetype })
    if (this.lock?.id === enemy.id) this.lock = null
    this.persist()
    if (enemy.camp === 'thorn') this.maybeClearCamp()
  }

  private touchObjectives(): void {
    this.maybeClearCamp()
    const dx = LAYOUT.needle.x - this.player.body.x
    const dz = LAYOUT.needle.z - this.player.body.z
    const dist = Math.hypot(dx, dz)
    if (dist < 8) {
      if (this.needleArm) {
        const adv = onNeedle(this.step)
        if (adv.toast && (adv.advanced || !this.needleTold)) {
          this.ui.pushToast(adv.toast)
          if (!adv.advanced) this.needleTold = true
        }
        if (adv.advanced) this.setStep(adv.step)
        this.needleArm = false
      }
    } else if (dist > 14) {
      this.needleArm = true
      this.needleTold = false
    }
  }

  private maybeClearCamp(): void {
    if (this.step !== 0) return
    if (this.flags.noenemies) {
      const d = Math.hypot(LAYOUT.camp.x - this.player.body.x, LAYOUT.camp.z - this.player.body.z)
      if (d > 12) return
    } else if (this.enemies.campRemaining() > 0) return
    else if (!this.enemies.hadCamp && !this.campSavedClear()) return
    const adv = onCampCleared(this.step)
    if (!adv.advanced) return
    if (adv.toast) this.ui.pushToast(adv.toast)
    this.setStep(adv.step)
  }

  private campSavedClear(): boolean {
    const ids = ['thorn-1', 'thorn-2', 'thorn-3', 'thorn-brute']
    return ids.every((id) => this.defeated.has(id))
  }

  private touchInteract(): void {
    if (!this.input.just('interact')) return
    if (this.mode !== 'play') return
    let best: { kind: string; name: string; d: number; x: number; z: number } | null = null
    for (const item of this.world.interactables) {
      const d = Math.hypot(item.x - this.player.body.x, item.z - this.player.body.z)
      if (d > item.radius) continue
      if (!best || d < best.d) best = { kind: item.kind, name: item.name, d, x: item.x, z: item.z }
    }
    if (!best) return
    if (best.kind === 'keeper') {
      this.openTalk('Keeper Bram', keeperLine(this.step))
      return
    }
    if (best.kind === 'needle') {
      this.openTalk('Chrome Needle', needleLine(this.step))
      return
    }
    this.player.vital.refill()
    this.player.stamina = this.player.staminaMax
    this.checkpoint = { x: this.player.body.x, y: this.player.body.y, z: this.player.body.z, label: 'Seamstone' }
    const adv = onSeamstone(this.step)
    if (adv.toast) this.ui.pushToast(adv.toast)
    if (adv.advanced) this.setStep(adv.step)
    this.events.emit('rest', { advanced: adv.advanced })
    this.fx.burst(best.x, this.player.body.y + 1.4, best.z, '#d8fff4', 14, 3)
    this.persist()
  }

  private openTalk(name: string, text: string): void {
    this.mode = 'dialogue'
    this.input.exitLock()
    this.ui.showDialogue(name, text, () => this.backToPlay())
  }

  private trackLock(): void {
    const wheel = this.input.consumeWheel()
    if (this.input.just('lock')) {
      this.lock = this.lock ? null : this.nearest(null)
    } else if (wheel !== 0 && this.lock) {
      this.lock = this.nearest(this.lock.id) ?? this.lock
    }
    if (this.lock && (!this.lock.alive || Math.hypot(this.lock.x - this.player.body.x, this.lock.z - this.player.body.z) > 22)) {
      this.lock = null
    }
  }

  private nearest(skip: string | null): Enemy | null {
    let best: Enemy | null = null
    let score = 18
    for (const enemy of this.enemies.living()) {
      if (enemy.id === skip) continue
      const d = Math.hypot(enemy.x - this.player.body.x, enemy.z - this.player.body.z)
      if (d < score) {
        score = d
        best = enemy
      }
    }
    return best
  }

  private paintHud(dt: number): void {
    if (this.mode !== 'play' && this.mode !== 'pause' && this.mode !== 'map' && this.mode !== 'dialogue') return
    const target = objectiveTarget(this.step)
    let compass: number | null = null
    if (target) {
      const dx = target.x - this.player.body.x
      const dz = target.z - this.player.body.z
      const lookX = -Math.sin(this.rig.yaw)
      const lookZ = -Math.cos(this.rig.yaw)
      const rel = Math.atan2(dx, dz) - Math.atan2(lookX, lookZ)
      compass = Math.atan2(Math.sin(rel), Math.cos(rel))
    }
    let prompt = ''
    if (this.mode === 'play') {
      let best = Infinity
      for (const item of this.world.interactables) {
        const d = Math.hypot(item.x - this.player.body.x, item.z - this.player.body.z)
        if (d < item.radius && d < best) {
          best = d
          prompt = `E — ${item.prompt}`
        }
      }
    }
    let reticle: { x: number; y: number } | null = null
    if (this.lock?.alive) {
      const v = new THREE.Vector3(this.lock.x, this.lock.hitY, this.lock.z)
      v.project(this.camera)
      if (v.z < 1) {
        const w = this.renderer.domElement.clientWidth
        const h = this.renderer.domElement.clientHeight
        reticle = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h }
      }
    }
    if (this.mode === 'play') this.hintT = Math.max(0, this.hintT - dt)
    const view: HudView = {
      area: this.area ? areaName(this.area) : 'Crosscamp',
      objective: this.objectiveLine(),
      step: this.step,
      health: this.player.vital.hp,
      healthMax: this.player.vital.max,
      stamina: this.player.stamina,
      staminaMax: this.player.staminaMax,
      prompt,
      hint: this.hintT > 0 && this.mode === 'play',
      lookTip: this.mode === 'play' && !this.input.locked && !this.flags.bot,
      reticle,
      compass,
      hurt: 0,
      downed: this.player.downed,
      debug: this.showDebug
        ? `${this.fps.toFixed(0)} fps\n${this.player.body.x.toFixed(1)}, ${this.player.body.y.toFixed(1)}, ${this.player.body.z.toFixed(1)}\n${this.area} ${this.player.body.swimming ? 'swim' : this.player.body.grounded ? 'ground' : 'air'}\nobj ${this.step} enemies ${this.enemies.living().length}`
        : '',
    }
    if (this.mode === 'play') this.ui.render(view, dt)
  }

  private objectiveLine(): string {
    return objectiveText(this.step, Math.max(this.enemies.campRemaining(), this.step === 0 && this.flags.noenemies ? 1 : 0))
  }

  private setStep(step: ObjectiveStep): void {
    this.step = step
    this.events.emit('objective', { step, text: this.objectiveLine() })
    this.persist()
  }

  private persist(): void {
    writeSave({
      v: 1,
      objective: this.step,
      checkpoint: this.checkpoint,
      defeated: [...this.defeated],
    })
  }

  private respawn(): void {
    const y = this.ground(this.checkpoint.x, this.checkpoint.z, this.checkpoint.y)
    this.player.revive(this.checkpoint.x, this.checkpoint.z, y)
    this.enemies.resetLiving()
    this.lock = null
    this.ui.pushToast(`The seam pulls you back to ${this.checkpoint.label}.`)
  }

  private respawnEnemies(): void {
    this.enemies.destroy()
    this.enemies = new EnemyDirector(this.scene, this.defeated, !this.flags.noenemies, (x, z) => terrainHeight(x, z))
  }

  private ground(x: number, z: number, feetY: number): number {
    return groundTop(x, z, feetY, terrainHeight(x, z), this.world.blocks)
  }

  private probe() {
    return {
      ground: (x: number, z: number, feetY: number) => this.ground(x, z, feetY),
      waterSurface,
      blocks: this.world.blocks,
      limit: LAYOUT.limit,
    }
  }

  private setQuality(quality: Quality): void {
    this.settings.quality = quality
    saveSettings(this.settings)
    this.renderer.shadowMap.enabled = quality !== 'low'
    this.world.setQuality(quality)
    this.post.applyQuality(quality)
    this.applySize()
  }

  private present(real: number): void {
    this.renderer.toneMappingExposure = this.world.look.exposure
    this.post.setGrade(this.world.look.lift, this.world.look.gain, this.world.look.contrast)
    this.post.setTime(real)
    this.fx.update(real)
    this.post.render()
  }

  private applySize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const phone = window.matchMedia('(pointer: coarse)').matches && w < 1000
    const cap = phone
      ? this.settings.quality === 'high'
        ? 1.25
        : 1
      : this.settings.quality === 'low'
        ? 1
        : this.settings.quality === 'high'
          ? 1.5
          : 1.25
    const ratio = Math.min(window.devicePixelRatio || 1, cap)
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(w, h, false)
    this.post.setSize(w, h, ratio)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }
}

function preferLowOnPhone(): boolean {
  try {
    if (localStorage.getItem('echofield-settings')) return false
  } catch {
    return false
  }
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1000
}

function keeperLine(step: ObjectiveStep): string {
  switch (step) {
    case 0:
      return 'West of the fire, Thorn Camp still bites. Quiet it, then rest your hand on the Seamstone.'
    case 1:
      return 'The Seamstone stands just south of the old ring. It will know you now that the camp is still.'
    case 2:
      return 'Cross the canal on the east road. The Chrome Needle is the bright stitch in the Neon Vein.'
    case 3:
      return 'You walked the seam and it held. Bone Fen and the Glass Expanse are still out there, if your legs are.'
  }
}

function needleLine(step: ObjectiveStep): string {
  if (step >= 2 && step !== 2) return 'It hums in four colors at once. The seam is holding.'
  if (step === 2) return 'You are close enough. Stay in its light — it is already answering.'
  return 'The spire is dark. Thorn Camp and the Seamstone still have a claim on you.'
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
