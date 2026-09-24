/** Game clock with a short hit-stop scale for landed blows. */
export class Time {
  scale = 1
  hitstop = 0
  elapsed = 0
  frame = 0

  tick(realDt: number): number {
    this.frame += 1
    const dt = Math.min(Math.max(realDt, 0), 0.1)
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt)
      const scaled = dt * 0.06
      this.elapsed += scaled
      return scaled
    }
    const scaled = dt * this.scale
    this.elapsed += scaled
    return scaled
  }

  punch(seconds = 0.05): void {
    this.hitstop = Math.max(this.hitstop, seconds)
  }
}
