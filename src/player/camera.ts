import * as THREE from 'three'
import { clamp, damp, dampAngle, yawToward } from '../core/math.ts'
import { terrainHeight } from '../physics/heightfield.ts'

export class CameraRig {
  yaw = 0
  pitch = 0.42
  distance = 6.6
  shake = 0

  private readonly look = new THREE.Vector3()
  private readonly desired = new THREE.Vector3()

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount)
  }

  lateUpdate(
    camera: THREE.PerspectiveCamera,
    dt: number,
    px: number,
    py: number,
    pz: number,
    mouseX: number,
    mouseY: number,
    stickX: number,
    stickY: number,
    sensitivity: number,
    lockPoint: { x: number; y: number; z: number } | null,
    allowShake: boolean,
  ): void {
    if (lockPoint) {
      const dx = lockPoint.x - px
      const dz = lockPoint.z - pz
      this.yaw = dampAngle(this.yaw, yawToward(dx, dz), 8, dt)
      this.pitch = damp(this.pitch, 0.36, 6, dt)
      this.distance = damp(this.distance, 5.6, 4, dt)
    } else {
      this.yaw -= mouseX * 0.0022 * sensitivity
      this.pitch -= mouseY * 0.0018 * sensitivity
      this.yaw -= stickX * dt * 1.8 * sensitivity
      this.pitch -= stickY * dt * 1.25 * sensitivity
      this.pitch = clamp(this.pitch, -0.28, 1.05)
      this.distance = damp(this.distance, 6.7, 4, dt)
    }

    const cosP = Math.cos(this.pitch)
    const ox = Math.sin(this.yaw) * cosP * this.distance
    const oy = Math.sin(this.pitch) * this.distance + 1.45
    const oz = Math.cos(this.yaw) * cosP * this.distance
    this.look.set(px, py + 1.35, pz)
    this.desired.set(px + ox, py + oy, pz + oz)

    const pulled = this.avoidTerrain(this.look, this.desired)
    let sx = 0
    let sy = 0
    if (allowShake && this.shake > 0.001) {
      sx = (Math.random() - 0.5) * this.shake * 0.35
      sy = (Math.random() - 0.5) * this.shake * 0.25
      this.shake = Math.max(0, this.shake - dt * 1.8)
    } else {
      this.shake = 0
    }
    camera.position.set(pulled.x + sx, pulled.y + sy, pulled.z)
    camera.lookAt(this.look)
  }

  private avoidTerrain(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    const out = to.clone()
    for (let i = 1; i <= 8; i++) {
      const t = i / 8
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y - from.y) * t
      const z = from.z + (to.z - from.z) * t
      if (terrainHeight(x, z) + 0.45 > y) {
        const p = (i - 1) / 8
        out.set(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p, from.z + (to.z - from.z) * p)
        break
      }
    }
    return out
  }
}
