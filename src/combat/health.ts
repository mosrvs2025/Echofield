export type HurtResult = 'none' | 'hit' | 'stagger' | 'dead'

export class Vital {
  hp: number
  max: number
  poise: number
  poiseMax: number
  stagger = 0
  invuln = 0

  constructor(hp: number, poise: number) {
    this.hp = hp
    this.max = hp
    this.poise = poise
    this.poiseMax = poise
  }

  get alive(): boolean {
    return this.hp > 0
  }

  update(dt: number): void {
    this.invuln = Math.max(0, this.invuln - dt)
    this.stagger = Math.max(0, this.stagger - dt)
    if (this.stagger <= 0 && this.alive && this.poise < this.poiseMax) {
      this.poise = Math.min(this.poiseMax, this.poise + dt * 10)
    }
  }

  hurt(amount: number, poiseDmg: number, invuln: number, staggerTime = 0.8): HurtResult {
    if (!this.alive || this.invuln > 0) return 'none'
    this.hp = Math.max(0, this.hp - amount)
    this.invuln = invuln
    this.poise -= poiseDmg
    if (this.hp <= 0) return 'dead'
    if (this.poise <= 0) {
      this.poise = this.poiseMax
      this.stagger = staggerTime
      return 'stagger'
    }
    return 'hit'
  }

  refill(): void {
    this.hp = this.max
    this.poise = this.poiseMax
    this.stagger = 0
  }
}
