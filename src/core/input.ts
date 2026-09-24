/** Touch UI, a coarse pointer, or a narrow viewport — pointer lock fights the on-screen stick. */
export function prefersTouchLook(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('touch')) return true
  if (typeof window === 'undefined') return false
  const narrow = window.innerWidth > 0 && window.innerWidth < 820
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return narrow || coarse
}

/**
 * Map a pointer offset from the stick center into camera-relative axes.
 * Screen up is negative `dy` and becomes positive `ay` (forward).
 */
export function stickAxes(dx: number, dy: number, radius: number): { ax: number; ay: number } {
  const max = Math.max(1, radius)
  let x = dx
  let y = dy
  const len = Math.hypot(x, y)
  if (len > max) {
    x = (x / len) * max
    y = (y / len) * max
  }
  let ax = x / max
  let ay = -y / max
  const mag = Math.hypot(ax, ay)
  const dead = 0.16
  if (mag < dead) return { ax: 0, ay: 0 }
  const scaled = Math.min(1, (mag - dead) / (1 - dead))
  return { ax: (ax / mag) * scaled, ay: (ay / mag) * scaled }
}

export type Action =
  | 'jump'
  | 'light'
  | 'heavy'
  | 'dodge'
  | 'lock'
  | 'interact'
  | 'pause'
  | 'map'
  | 'parry'
  | 'sprint'
  | 'debug'

export interface VirtualInput {
  ax: number
  ay: number
  pressed: Action[]
  yaw: number | null
}

const KEY_ACTIONS: Record<string, Action> = {
  Space: 'jump',
  KeyQ: 'dodge',
  KeyE: 'interact',
  KeyF: 'parry',
  KeyM: 'map',
  Tab: 'lock',
  Escape: 'pause',
  F3: 'debug',
}

export class Input {
  axisX = 0
  axisY = 0
  /** Pointer pixels accumulated since the last sample. */
  lookX = 0
  lookY = 0
  /** Right stick / arrow keys, roughly -1..1. Integrate with dt. */
  lookStickX = 0
  lookStickY = 0
  sprint = false
  locked = false
  virtual: VirtualInput | null = null
  touching = false

  private touchAx = 0
  private touchAy = 0
  private touchLookX = 0
  private touchLookY = 0
  private touchSprint = false

  private readonly keys = new Set<string>()
  private readonly edges = new Set<Action>()
  private readonly mouseDown = new Set<number>()
  private mouseDX = 0
  private mouseDY = 0
  private wheel = 0
  private prevPad = new Set<number>()
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      const action = KEY_ACTIONS[e.code]
      if (action) {
        if (e.code === 'Tab' || e.code === 'Space') e.preventDefault()
        this.edges.add(action)
      }
      if (e.code.startsWith('Arrow')) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseDown.clear()
    })
    window.addEventListener('mousedown', (e) => {
      const target = e.target
      if (target instanceof Element && target.closest('button, input, a, label, .stick-zone, .look-zone, .touch-actions')) return
      this.mouseDown.add(e.button)
      if (e.button === 0) this.edges.add('light')
      if (e.button === 1) this.edges.add('lock')
      if (e.button === 2) this.edges.add('heavy')
    })
    window.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button))
    window.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY)
    }, { passive: true })
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDX += e.movementX
        this.mouseDY += e.movementY
      }
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas
    })
    this.canvas.addEventListener('click', () => {
      if (prefersTouchLook()) return
      if (document.pointerLockElement !== this.canvas && this.canvas.dataset.lock === '1') {
        this.requestLock()
      }
    })
  }

  requestLock(): void {
    if (prefersTouchLook()) {
      this.exitLock()
      return
    }
    this.canvas.dataset.lock = '1'
    const request = this.canvas.requestPointerLock()
    if (request && typeof request.then === 'function') void request.catch(() => undefined)
  }

  exitLock(): void {
    this.canvas.dataset.lock = '0'
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  setStick(ax: number, ay: number): void {
    this.touching = true
    this.touchAx = ax
    this.touchAy = ay
    this.touchSprint = Math.hypot(ax, ay) > 0.82
  }

  clearStick(): void {
    this.touchAx = 0
    this.touchAy = 0
    this.touchSprint = false
  }

  addLook(dx: number, dy: number): void {
    this.touching = true
    this.touchLookX += dx
    this.touchLookY += dy
  }

  tap(action: Action): void {
    this.edges.add(action)
  }

  sample(): void {
    if (this.virtual) {
      this.axisX = this.virtual.ax
      this.axisY = this.virtual.ay
      this.lookX = 0
      this.lookY = 0
      this.lookStickX = 0
      this.lookStickY = 0
      this.sprint = true
      this.wheel = 0
      this.mouseDX = 0
      this.mouseDY = 0
      return
    }

    this.lookStickX = 0
    this.lookStickY = 0
    let x = 0
    let y = 0
    if (this.keys.has('KeyD')) x += 1
    if (this.keys.has('KeyA')) x -= 1
    if (this.keys.has('KeyW')) y += 1
    if (this.keys.has('KeyS')) y -= 1

    const gp = navigator.getGamepads?.()[0]
    if (gp) {
      const dead = 0.18
      const sx = Math.abs(gp.axes[0] ?? 0) > dead ? (gp.axes[0] ?? 0) : 0
      const sy = Math.abs(gp.axes[1] ?? 0) > dead ? -(gp.axes[1] ?? 0) : 0
      x += sx
      y += sy
      const rx = gp.axes[2] ?? 0
      const ry = gp.axes[3] ?? 0
      if (Math.abs(rx) > dead) this.lookStickX += rx
      if (Math.abs(ry) > dead) this.lookStickY += ry
      const buttons = [0, 1, 2, 3, 4, 5, 7, 8, 9]
      const mapping: Record<number, Action> = {
        0: 'jump',
        1: 'dodge',
        2: 'light',
        3: 'heavy',
        4: 'parry',
        5: 'lock',
        6: 'interact',
        7: 'sprint',
        8: 'map',
        9: 'pause',
      }
      const down = new Set<number>()
      gp.buttons.forEach((b, i) => {
        if (b.pressed) down.add(i)
      })
      for (const i of buttons) {
        if (down.has(i) && !this.prevPad.has(i)) {
          const action = mapping[i]
          if (action && action !== 'sprint') this.edges.add(action)
        }
      }
      if (down.has(6) && !this.prevPad.has(6)) this.edges.add('interact')
      this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || down.has(7)
      this.prevPad = down
    } else {
      this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      this.prevPad.clear()
    }

    if (this.keys.has('ArrowLeft')) this.lookStickX -= 1
    if (this.keys.has('ArrowRight')) this.lookStickX += 1
    if (this.keys.has('ArrowUp')) this.lookStickY -= 1
    if (this.keys.has('ArrowDown')) this.lookStickY += 1

    if (this.touchAx !== 0 || this.touchAy !== 0) {
      x += this.touchAx
      y += this.touchAy
    }
    if (this.touchSprint) this.sprint = true

    this.axisX = x
    this.axisY = y
    this.lookX = this.mouseDX + this.touchLookX
    this.lookY = this.mouseDY + this.touchLookY
    this.mouseDX = 0
    this.mouseDY = 0
    this.touchLookX = 0
    this.touchLookY = 0
  }

  just(action: Action): boolean {
    if (this.virtual?.pressed.includes(action)) return true
    return this.edges.has(action)
  }

  consumeWheel(): number {
    const w = this.wheel
    this.wheel = 0
    return w
  }

  endFrame(): void {
    this.edges.clear()
    this.lookX = 0
    this.lookY = 0
    this.lookStickX = 0
    this.lookStickY = 0
    this.axisX = 0
    this.axisY = 0
  }
}
