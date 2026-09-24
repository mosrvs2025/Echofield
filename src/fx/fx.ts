import * as THREE from 'three'

interface Mote {
  mesh: THREE.Mesh
  life: number
  max: number
  vx: number
  vy: number
  vz: number
  gravity: number
}

interface Ring {
  mesh: THREE.Mesh
  life: number
  max: number
}

export class FX {
  shake = 0
  private readonly free: Mote[] = []
  private readonly live: Mote[] = []
  private readonly rings: Ring[] = []

  constructor(parent: THREE.Object3D) {
    const geo = new THREE.OctahedronGeometry(0.07, 0)
    for (let i = 0; i < 80; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0, depthWrite: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      parent.add(mesh)
      this.free.push({ mesh, life: 0, max: 1, vx: 0, vy: 0, vz: 0, gravity: 10 })
    }
    const ringGeo = new THREE.RingGeometry(0.25, 0.38, 20)
    ringGeo.rotateX(-Math.PI / 2)
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#d9fff6',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(ringGeo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      parent.add(mesh)
      this.rings.push({ mesh, life: 0, max: 1 })
    }
  }

  burst(x: number, y: number, z: number, color: string, count = 10, speed = 4): void {
    this.spray(x, y, z, color, count, speed, 9, 0.4)
  }

  impact(x: number, y: number, z: number): void {
    this.spray(x, y, z, '#fff1c4', 14, 6.5, 7, 0.32)
    this.spray(x, y, z, '#ffb15a', 6, 3.2, 4, 0.28)
    this.shake = Math.min(1.2, this.shake + 0.35)
  }

  dust(x: number, y: number, z: number): void {
    this.spray(x, y + 0.05, z, '#cbb89a', 3, 1.4, 1.2, 0.45)
  }

  splash(x: number, y: number, z: number): void {
    this.spray(x, y, z, '#d8fff8', 12, 3.4, 6, 0.5)
    this.ring(x, y + 0.05, z, '#e7fffb')
    this.shake = Math.min(0.8, this.shake + 0.12)
  }

  trail(x: number, y: number, z: number): void {
    this.spray(x, y, z, '#f6edd4', 2, 1.5, 1.4, 0.32)
  }

  flash(x: number, y: number, z: number): void {
    this.spray(x, y, z, '#fffaf0', 14, 5.5, 2.4, 0.28)
    this.spray(x, y, z, '#ffe08a', 6, 3, 1.5, 0.22)
    this.ring(x, y, z, '#fff6d2')
    this.shake = Math.min(1, this.shake + 0.18)
  }

  private spray(x: number, y: number, z: number, color: string, count: number, speed: number, gravity: number, life: number): void {
    for (let i = 0; i < count; i++) {
      const mote = this.free.pop()
      if (!mote) return
      mote.mesh.position.set(x, y, z)
      mote.mesh.visible = true
      mote.mesh.scale.setScalar(0.6 + Math.random() * 1.1)
      const mat = mote.mesh.material
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.set(color)
        mat.opacity = 1
      }
      const theta = Math.random() * Math.PI * 2
      const kick = speed * (0.35 + Math.random())
      mote.vx = Math.cos(theta) * kick
      mote.vz = Math.sin(theta) * kick
      mote.vy = gravity * 0.18 + Math.random() * speed * 0.55
      mote.gravity = gravity
      mote.life = life + Math.random() * 0.2
      mote.max = mote.life
      this.live.push(mote)
    }
  }

  private ring(x: number, y: number, z: number, color: string): void {
    const ring = this.rings.find((item) => item.life <= 0)
    if (!ring) return
    ring.mesh.position.set(x, y, z)
    ring.mesh.scale.setScalar(0.4)
    ring.mesh.visible = true
    const mat = ring.mesh.material
    if (mat instanceof THREE.MeshBasicMaterial) {
      mat.color.set(color)
      mat.opacity = 0.7
    }
    ring.life = 0.55
    ring.max = 0.55
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 1.6)
    for (let i = this.live.length - 1; i >= 0; i--) {
      const mote = this.live[i]!
      mote.life -= dt
      mote.vy -= mote.gravity * dt
      mote.mesh.position.x += mote.vx * dt
      mote.mesh.position.y += mote.vy * dt
      mote.mesh.position.z += mote.vz * dt
      const mat = mote.mesh.material
      if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = Math.max(0, mote.life / mote.max)
      if (mote.life <= 0) {
        mote.mesh.visible = false
        this.live.splice(i, 1)
        this.free.push(mote)
      }
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue
      ring.life -= dt
      const k = 1 - ring.life / ring.max
      ring.mesh.scale.setScalar(0.4 + k * 3.2)
      const mat = ring.mesh.material
      if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = Math.max(0, 0.7 * (1 - k))
      if (ring.life <= 0) ring.mesh.visible = false
    }
  }
}
