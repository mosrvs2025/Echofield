import type { GameEvents, Emitter } from '../core/events.ts'

/** Procedural Web Audio. If the context cannot start, every cue stays silent. */
export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private padA: OscillatorNode | null = null
  private padB: OscillatorNode | null = null
  silent = false
  private readonly events: Emitter<GameEvents>

  constructor(events: Emitter<GameEvents>) {
    this.events = events
  }

  attach(): void {
    this.events.on('swing', (e) => this.swing(e.heavy))
    this.events.on('hurt', (e) => (e.who === 'player' ? this.hurt() : this.hit(e.heavy)))
    this.events.on('defeat', () => this.defeat())
    this.events.on('rest', () => this.chime())
    this.events.on('objective', () => this.stinger())
    this.events.on('parry', () => this.ping())
    this.events.on('splash', () => this.splash())
  }

  resume(volume: number): void {
    if (this.silent) return
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) {
        this.silent = true
        return
      }
      if (!this.ctx) {
        this.ctx = new Ctx()
        this.master = this.ctx.createGain()
        this.master.connect(this.ctx.destination)
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        this.noise = buffer
        this.startPad()
      }
      void this.ctx.resume()
      this.setVolume(volume)
    } catch {
      this.silent = true
    }
  }

  setVolume(volume: number): void {
    if (!this.master || !this.ctx) return
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.8, this.ctx.currentTime, 0.05)
  }

  private startPad(): void {
    if (!this.ctx || !this.master) return
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.connect(this.master)
    this.padA = this.osc(98, 0.02, 'sine', filter)
    this.padB = this.osc(146, 0.015, 'triangle', filter)
  }

  setBiome(id: string): void {
    if (!this.ctx || !this.padA || !this.padB) return
    const freq = id === 'neon' ? 130 : id === 'fen' ? 82 : id === 'glass' ? 174 : id === 'verdant' ? 110 : 98
    const t = this.ctx.currentTime
    this.padA.frequency.setTargetAtTime(freq, t, 0.4)
    this.padB.frequency.setTargetAtTime(freq * 1.5, t, 0.4)
  }

  private swing(heavy: boolean): void {
    this.noiseBurst(heavy ? 0.18 : 0.09, heavy ? 0.12 : 0.07, heavy ? 0.5 : 0.8)
    this.tone(heavy ? 140 : 220, heavy ? 0.16 : 0.08, 'sawtooth', heavy ? 0.05 : 0.03, heavy ? 70 : 110)
  }

  private hit(heavy: boolean): void {
    this.tone(heavy ? 90 : 160, 0.12, 'square', 0.06, 50)
    this.noiseBurst(0.08, 0.08, 0.4)
  }

  private hurt(): void {
    this.tone(110, 0.2, 'sawtooth', 0.07, 50)
  }

  private defeat(): void {
    this.tone(320, 0.25, 'triangle', 0.05, 80)
    this.noiseBurst(0.2, 0.06, 0.3)
  }

  private chime(): void {
    this.tone(523, 0.4, 'sine', 0.05, 523)
    this.tone(659, 0.5, 'sine', 0.04, 659)
    this.tone(784, 0.7, 'sine', 0.035, 784)
  }

  private stinger(): void {
    this.tone(392, 0.18, 'triangle', 0.04, 523)
  }

  private ping(): void {
    this.tone(880, 0.12, 'sine', 0.06, 1320)
  }

  private splash(): void {
    this.noiseBurst(0.22, 0.08, 0.35)
    this.tone(180, 0.15, 'sine', 0.04, 90)
  }

  private osc(freq: number, gain: number, type: OscillatorType, dest: AudioNode): OscillatorNode | null {
    if (!this.ctx) return null
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    amp.gain.value = gain
    osc.connect(amp)
    amp.connect(dest)
    osc.start()
    return osc
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, to: number): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(1, freq), t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noiseBurst(dur: number, gain: number, rate: number): void {
    if (!this.ctx || !this.master || !this.noise) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = rate
    const amp = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(amp)
    amp.connect(this.master)
    src.start(t)
    src.stop(t + dur)
  }
}
