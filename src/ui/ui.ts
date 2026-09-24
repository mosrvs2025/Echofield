import { prefersTouchLook, stickAxes, type Action, type Input } from '../core/input.ts'
import type { Quality, Settings } from '../core/settings.ts'

export interface UiHooks {
  begin: () => void
  continue: () => void
  resume: () => void
  quit: () => void
  quality: (q: Quality) => void
  sensitivity: (n: number) => void
  volume: (n: number) => void
  shake: (on: boolean) => void
}

export interface HudView {
  area: string
  objective: string
  step: number
  health: number
  healthMax: number
  stamina: number
  staminaMax: number
  prompt: string
  hint: boolean
  lookTip: boolean
  reticle: { x: number; y: number } | null
  compass: number | null
  hurt: number
  downed: boolean
  debug: string
}

export class UI {
  private readonly root: HTMLElement
  private readonly settings: Settings
  private readonly hooks: UiHooks
  private readonly bootStatus: HTMLElement
  private readonly actions: HTMLElement
  private readonly hud: HTMLElement
  private readonly pause: HTMLElement
  private readonly map: HTMLElement
  private readonly mapCanvas: HTMLCanvasElement
  private readonly dialogue: HTMLElement
  private toastTimer = 0
  private hurt = 0
  private touch: HTMLElement | null = null

  constructor(root: HTMLElement, settings: Settings, hooks: UiHooks) {
    this.root = root
    this.settings = settings
    this.hooks = hooks
    this.bootStatus = must('#boot-status')
    this.actions = must('#boot-actions')
    this.hud = this.buildHud()
    this.pause = this.buildPause()
    this.map = this.buildMap()
    this.mapCanvas = must('#map-canvas', this.map) as HTMLCanvasElement
    this.dialogue = this.buildDialogue()
    root.append(this.hud, this.pause, this.map, this.dialogue)
  }

  boot(text: string): void {
    this.bootStatus.textContent = text
  }

  showTitle(hasContinue: boolean): void {
    this.bootStatus.textContent = 'Click to begin. The field stays where you leave it.'
    this.actions.hidden = false
    this.actions.replaceChildren()
    this.actions.append(
      button('Begin walk', () => this.hooks.begin()),
      hasContinue ? button('Continue', () => this.hooks.continue(), 'alt') : document.createElement('span'),
    )
    const prefs = document.createElement('div')
    prefs.append(this.qualityChoices(), this.sliders())
    this.actions.append(prefs)
    this.root.dataset.ready = '1'
    this.setScreen('title')
  }

  setScreen(screen: 'title' | 'play' | 'pause' | 'map' | 'dialogue'): void {
    must('#boot').classList.toggle('hidden', screen !== 'title')
    this.hud.classList.toggle('hidden', screen === 'title')
    this.touch?.classList.toggle('hidden', screen !== 'play')
    this.pause.classList.toggle('hidden', screen !== 'pause')
    this.map.classList.toggle('hidden', screen !== 'map')
    this.dialogue.classList.toggle('hidden', screen !== 'dialogue')
  }

  showDialogue(name: string, text: string, onClose: () => void): void {
    must('#dlg-name', this.dialogue).textContent = name
    must('#dlg-body', this.dialogue).textContent = text
    const close = must('#dlg-close', this.dialogue) as HTMLButtonElement
    close.onclick = () => onClose()
    this.setScreen('dialogue')
  }

  pushToast(text: string): void {
    const node = must('#toast', this.hud)
    node.textContent = text
    node.classList.remove('hidden')
    this.toastTimer = 3.4
  }

  tick(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) must('#toast', this.hud).classList.add('hidden')
    }
    this.hurt = Math.max(0, this.hurt - dt)
  }

  flashHurt(): void {
    this.hurt = 0.35
  }

  drawMap(player: { x: number; z: number }, step: number): void {
    const canvas = this.mapCanvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#241c16'
    ctx.fillRect(0, 0, w, h)
    const project = (x: number, z: number) => ({
      x: ((x + 120) / 240) * w,
      y: ((z + 120) / 240) * h,
    })
    const blot = (x: number, z: number, rw: number, rh: number, color: string) => {
      const p = project(x, z)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, rw, rh, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    blot(-36, 30, 28, 18, '#1c6e78')
    blot(48, 0, 8, 26, '#1c6e78')
    blot(6, -70, 22, 14, '#2a403c')
    ctx.fillStyle = '#efe2c9'
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif'
    const labels: [string, number, number][] = [
      ['Crosscamp', 0, 0],
      ['Verdant Rift', -70, -28],
      ['Neon Vein', 78, -24],
      ['Bone Fen', -8, -90],
      ['Glass Expanse', 10, 78],
    ]
    for (const [label, x, z] of labels) {
      const p = project(x, z)
      ctx.fillText(label, p.x - 28, p.y)
    }
    const marks: [number, number, string][] = [
      [-72, -2, '#d6453d'],
      [-54, 11, '#7dffe2'],
      [88, 2, '#39f0e0'],
    ]
    for (const [x, z, color] of marks) {
      const p = project(x, z)
      ctx.fillStyle = color
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6)
    }
    const you = project(player.x, player.z)
    ctx.strokeStyle = '#e4b15a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(you.x, you.y, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#efe2c9'
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    const names = ['Thorn Camp', 'Seamstone', 'Chrome Needle', 'Roam']
    ctx.fillText(names[step] ?? '', 12, h - 12)
  }

  render(view: HudView, dt: number): void {
    this.tick(dt)
    must('#area-name', this.hud).textContent = view.area
    const obj = must('#objective', this.hud)
    obj.textContent = view.objective
    obj.dataset.step = String(view.step)
    const hp = must('#hp', this.hud)
    hp.style.transform = `scaleX(${Math.max(0, view.health / view.healthMax)})`
    hp.parentElement?.classList.toggle('low', view.health / view.healthMax < 0.3)
    must('#sp', this.hud).style.transform = `scaleX(${Math.max(0, view.stamina / view.staminaMax)})`
    const prompt = must('#prompt', this.hud)
    prompt.textContent = view.prompt
    prompt.classList.toggle('hidden', view.prompt.length === 0)
    must('#hint', this.hud).classList.toggle('hidden', !view.hint)
    must('#look-tip', this.hud).classList.toggle('hidden', !view.lookTip)
    const reticle = must('#reticle', this.hud)
    if (view.reticle) {
      reticle.classList.remove('hidden')
      reticle.style.left = `${view.reticle.x}px`
      reticle.style.top = `${view.reticle.y}px`
    } else reticle.classList.add('hidden')
    const compass = must('#compass-arrow', this.hud)
    compass.parentElement?.classList.toggle('hidden', view.compass === null)
    if (view.compass !== null) compass.style.transform = `rotate(${view.compass}rad)`
    const veil = must('#veil', this.hud)
    const showHurt = view.hurt > 0 || this.hurt > 0 || view.health / view.healthMax < 0.28
    veil.classList.toggle('on', showHurt)
    must('#death', this.hud).classList.toggle('hidden', !view.downed)
    const debug = must('#debug', this.hud)
    debug.textContent = view.debug
    debug.classList.toggle('hidden', view.debug.length === 0)
  }

  mountTouch(input: Input): void {
    const enable = () => this.ensureTouch(input)
    enable()
    window.addEventListener('resize', enable)
  }

  private ensureTouch(input: Input): void {
    if (this.touch || !prefersTouchLook()) return
    document.documentElement.classList.add('touch')
    const pad = document.createElement('div')
    pad.className = 'touch hidden'
    pad.innerHTML = `
      <div class="stick-zone" id="stick-zone"><i id="stick-knob"></i></div>
      <div class="look-zone" id="look-zone"></div>
      <div class="touch-actions">
        <button type="button" data-act="interact">Talk</button>
        <button type="button" data-act="parry">Parry</button>
        <button type="button" data-act="dodge">Dodge</button>
        <button type="button" data-act="jump">Jump</button>
        <button type="button" data-act="heavy">Heavy</button>
        <button type="button" data-act="light">Strike</button>
      </div>
    `
    this.root.append(pad)
    this.touch = pad
    const zone = must('#stick-zone', pad)
    const knob = must('#stick-knob', pad)
    let stickId = -1

    const applyStick = (clientX: number, clientY: number) => {
      const rect = zone.getBoundingClientRect()
      const radius = Math.max(28, Math.min(rect.width, rect.height) * 0.42)
      const dx = clientX - (rect.left + rect.width * 0.5)
      const dy = clientY - (rect.top + rect.height * 0.5)
      const len = Math.hypot(dx, dy) || 1
      const clamped = Math.min(radius, len)
      knob.style.transform = `translate(${(dx / len) * clamped}px, ${(dy / len) * clamped}px)`
      const axes = stickAxes(dx, dy, radius)
      input.setStick(axes.ax, axes.ay)
    }

    const onStickDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      stickId = e.pointerId
      try {
        zone.setPointerCapture(e.pointerId)
      } catch {
        /* capture can fail if the pointer already ended */
      }
      applyStick(e.clientX, e.clientY)
    }
    const onStickMove = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return
      e.preventDefault()
      e.stopPropagation()
      applyStick(e.clientX, e.clientY)
    }
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return
      e.preventDefault()
      stickId = -1
      knob.style.transform = 'translate(0px, 0px)'
      input.clearStick()
      if (zone.hasPointerCapture(e.pointerId)) zone.releasePointerCapture(e.pointerId)
    }
    zone.addEventListener('pointerdown', onStickDown, { passive: false })
    zone.addEventListener('pointermove', onStickMove, { passive: false })
    zone.addEventListener('pointerup', endStick, { passive: false })
    zone.addEventListener('pointercancel', endStick, { passive: false })
    zone.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId !== stickId) return
      stickId = -1
      knob.style.transform = 'translate(0px, 0px)'
      input.clearStick()
    })
    const blockTouch = (e: TouchEvent) => e.preventDefault()
    zone.addEventListener('touchstart', blockTouch, { passive: false })
    zone.addEventListener('touchmove', blockTouch, { passive: false })

    const look = must('#look-zone', pad)
    let lookId = -1
    let lastX = 0
    let lastY = 0
    look.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      lookId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      try {
        look.setPointerCapture(e.pointerId)
      } catch {
        /* capture can fail if the pointer already ended */
      }
    }, { passive: false })
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return
      e.preventDefault()
      input.addLook((e.clientX - lastX) * 1.35, (e.clientY - lastY) * 1.35)
      lastX = e.clientX
      lastY = e.clientY
    }, { passive: false })
    const endLook = (e: PointerEvent) => {
      if (e.pointerId === lookId) lookId = -1
    }
    look.addEventListener('pointerup', endLook, { passive: false })
    look.addEventListener('pointercancel', endLook, { passive: false })
    look.addEventListener('touchstart', blockTouch, { passive: false })
    look.addEventListener('touchmove', blockTouch, { passive: false })

    pad.querySelectorAll('button[data-act]').forEach((node) => {
      node.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const act = (node as HTMLElement).dataset.act
        if (act) input.tap(act as Action)
      }, { passive: false })
    })
    const hint = must('#hint', this.hud)
    hint.textContent = 'Left stick walks. Drag the right side to look. Strike, dodge, and jump sit on the right.'
    if (!this.hud.classList.contains('hidden')) pad.classList.remove('hidden')
  }

  private buildHud(): HTMLElement {
    const hud = document.createElement('div')
    hud.className = 'hud hidden'
    hud.innerHTML = `
      <div class="area"><small>Echofield</small><strong id="area-name">Crosscamp</strong></div>
      <div class="objective" id="objective" data-step="0"></div>
      <div class="compass"><b>N</b><i id="compass-arrow"></i></div>
      <div class="bars">
        <div class="bar health"><span id="hp"></span><em>Health</em></div>
        <div class="bar stamina"><span id="sp"></span><em>Stamina</em></div>
      </div>
      <div id="prompt" class="prompt hidden"></div>
      <div id="toast" class="toast hidden"></div>
      <div id="hint" class="hint">WASD move · Shift sprint · Space jump · mouse look · LMB light chain · RMB heavy · Q dodge · F parry · Tab or middle mouse lock-on · E interact · M map · Esc pause</div>
      <div id="look-tip" class="look-tip hidden">Click the field to look around. Arrow keys turn the camera too.</div>
      <div id="reticle" class="reticle hidden"></div>
      <div id="veil" class="veil"></div>
      <div id="death" class="death hidden">The seam frays…</div>
      <div id="debug" class="debug hidden"></div>
    `
    return hud
  }

  private buildPause(): HTMLElement {
    const panel = document.createElement('section')
    panel.className = 'sheet hidden'
    panel.innerHTML = `<p class="eyebrow">Paused</p><h2 style="margin:0 0 8px;font-size:36px">Echofield</h2>`
    const row = document.createElement('div')
    row.className = 'row'
    row.append(
      button('Resume', () => this.hooks.resume()),
      button('Quit to title', () => this.hooks.quit(), 'alt'),
    )
    panel.append(row, this.qualityChoices(), this.sliders(), note())
    return panel
  }

  private buildMap(): HTMLElement {
    const wrap = document.createElement('section')
    wrap.className = 'map-card hidden'
    wrap.innerHTML = `<h2>Field sketch</h2><p style="margin:0 0 8px;font:13px ui-sans-serif,system-ui,sans-serif;opacity:.8">Not a survey. Just the seam.</p>`
    const canvas = document.createElement('canvas')
    canvas.id = 'map-canvas'
    canvas.width = 360
    canvas.height = 360
    wrap.append(canvas)
    return wrap
  }

  private buildDialogue(): HTMLElement {
    const node = document.createElement('section')
    node.className = 'dialogue hidden'
    node.innerHTML = `<strong id="dlg-name"></strong><p id="dlg-body"></p>`
    node.append(button('Close', () => undefined, ''))
    const close = node.querySelector('button')
    if (close) close.id = 'dlg-close'
    return node
  }

  private qualityChoices(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'choices'
    const label = document.createElement('span')
    label.textContent = 'Quality'
    label.style.alignSelf = 'center'
    label.style.font = '12px ui-sans-serif, system-ui, sans-serif'
    const low = button('Low', () => {
      this.settings.quality = 'low'
      this.hooks.quality('low')
      paint()
    })
    const med = button('Medium', () => {
      this.settings.quality = 'medium'
      this.hooks.quality('medium')
      paint()
    })
    const high = button('High', () => {
      this.settings.quality = 'high'
      this.hooks.quality('high')
      paint()
    })
    const paint = () => {
      low.setAttribute('aria-pressed', String(this.settings.quality === 'low'))
      med.setAttribute('aria-pressed', String(this.settings.quality === 'medium'))
      high.setAttribute('aria-pressed', String(this.settings.quality === 'high'))
    }
    paint()
    wrap.append(label, low, med, high)
    return wrap
  }

  private sliders(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.append(
      slider('Look', this.settings.sensitivity, 0.4, 2, 0.05, (v) => {
        this.settings.sensitivity = v
        this.hooks.sensitivity(v)
      }),
      slider('Volume', this.settings.volume, 0, 1, 0.05, (v) => {
        this.settings.volume = v
        this.hooks.volume(v)
      }),
    )
    const shake = document.createElement('label')
    shake.className = 'check'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.settings.shake
    box.addEventListener('change', () => {
      this.settings.shake = box.checked
      this.hooks.shake(box.checked)
    })
    shake.append(box, document.createTextNode('Camera shake'))
    wrap.append(shake)
    return wrap
  }
}

function button(text: string, onClick: () => void, kind = ''): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.textContent = text
  if (kind) node.className = kind
  node.addEventListener('click', onClick)
  return node
}

function slider(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'slider'
  const name = document.createElement('span')
  name.textContent = label
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  input.addEventListener('input', () => onInput(Number(input.value)))
  row.append(name, input)
  return row
}

function note(): HTMLElement {
  const p = document.createElement('p')
  p.className = 'lede'
  p.textContent = 'Settings stay in this browser. Rest at a Seamstone to mark your place.'
  return p
}

function must(selector: string, root: ParentNode = document): HTMLElement {
  const node = root.querySelector(selector)
  if (!(node instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
  return node
}
