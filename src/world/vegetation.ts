import * as THREE from 'three'
import { mulberry32 } from '../core/math.ts'
import type { Quality } from '../core/settings.ts'
import { aabb, type AABB } from '../physics/colliders.ts'
import { terrainHeight, waterDepth } from '../physics/heightfield.ts'
import { biomeAt } from './biomes.ts'
import { attachSway, tickSway } from './grass.ts'
import { onClearedGround } from './layout.ts'
import { cylGeo, mat } from './props.ts'

interface Batch {
  mesh: THREE.InstancedMesh
  full: number
  shadows: boolean
}

export class Vegetation {
  readonly group = new THREE.Group()
  readonly blocks: AABB[] = []
  private batches: Batch[] = []
  private readonly swayed: THREE.MeshStandardMaterial[] = []

  constructor(quality: Quality) {
    const rand = mulberry32(20260923)
    const trunks: THREE.Object3D[] = []
    const canopies: THREE.Object3D[] = []
    const dead: THREE.Object3D[] = []
    const poles: THREE.Object3D[] = []
    const grass: THREE.Object3D[] = []
    const rocks: THREE.Object3D[] = []
    const shards: THREE.Object3D[] = []
    const reeds: THREE.Object3D[] = []
    const plates: THREE.Object3D[] = []
    const bushes: THREE.Object3D[] = []
    const stalks: THREE.Object3D[] = []
    const caps: THREE.Object3D[] = []

    const dummy = new THREE.Object3D()
    const push = (list: THREE.Object3D[], x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = rand() * Math.PI * 2) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, rot, 0)
      dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      const holder = new THREE.Object3D()
      holder.matrix.copy(dummy.matrix)
      holder.matrixAutoUpdate = false
      list.push(holder)
    }

    for (let i = 0; i < 2800; i++) {
      const x = rand() * 220 - 110
      const z = rand() * 220 - 110
      if (onClearedGround(x, z, 5)) continue
      const depth = waterDepth(x, z)
      if (depth > 0.45) continue
      const y = terrainHeight(x, z)
      const slope = Math.abs(terrainHeight(x + 1.2, z) - y) + Math.abs(terrainHeight(x, z + 1.2) - y)
      if (slope > 2.4) continue
      const biome = biomeAt(x, z)
      const roll = rand()

      if (biome.dominant === 'verdant' && roll > 0.72 && trunks.length < 70) {
        const h = 2.2 + rand() * 2.4
        push(trunks, x, y + h * 0.5, z, 1, h / 2.4, 1)
        push(canopies, x, y + h + 0.6, z, 1.3 + rand(), 1.1 + rand() * 0.6, 1.3 + rand())
        this.blocks.push(aabb(x, y + 1.2, z, 0.38, 1.4, 0.38))
      } else if (biome.dominant === 'fen' && roll > 0.78 && dead.length < 36) {
        const h = 2.4 + rand() * 2
        push(dead, x, y + h * 0.5, z, 0.7, h / 2.2, 0.7)
        this.blocks.push(aabb(x, y + 1, z, 0.3, 1.2, 0.3))
      } else if (biome.dominant === 'neon' && roll > 0.8 && poles.length < 40) {
        push(poles, x, y + 1.8, z, 0.6 + rand() * 0.5, 1.4 + rand(), 0.6 + rand() * 0.5)
      } else if (biome.dominant === 'glass' && roll > 0.82 && shards.length < 40) {
        push(shards, x, y + 0.8, z, 0.5 + rand(), 1.2 + rand() * 1.6, 0.5 + rand(), rand() * 3)
      } else if (biome.dominant === 'verdant' && bushes.length < 90 && roll > 0.62) {
        push(bushes, x, y + 0.45, z, 0.7 + rand() * 0.6, 0.55 + rand() * 0.4, 0.7 + rand() * 0.5)
      } else if (biome.dominant === 'verdant' && grass.length < 1400) {
        push(grass, x, y + 0.35, z, 0.7 + rand() * 0.6, 0.55 + rand() * 0.9, 0.7 + rand() * 0.6)
      } else if (biome.dominant === 'fen' && caps.length < 48 && roll > 0.7) {
        push(caps, x, y + 0.35, z, 0.45 + rand() * 0.4, 0.5 + rand() * 0.5, 0.45 + rand() * 0.4)
      } else if (biome.dominant === 'fen' && reeds.length < 420) {
        push(reeds, x, y + 0.7, z, 0.35, 0.8 + rand(), 0.35)
      } else if (biome.dominant === 'neon' && stalks.length < 80 && roll > 0.5) {
        push(stalks, x, y + 1.1, z, 0.35 + rand() * 0.4, 1.1 + rand() * 0.8, 0.35 + rand() * 0.4)
      } else if (biome.dominant === 'neon' && plates.length < 140 && roll > 0.4) {
        push(plates, x, y + 0.08, z, 0.8 + rand(), 0.15, 0.8 + rand())
      } else if (rocks.length < 160 && roll > 0.88) {
        push(rocks, x, y + 0.3, z, 0.5 + rand() * 0.8, 0.4 + rand() * 0.5, 0.5 + rand() * 0.8)
      }
    }

    for (let i = 0; i < 4200; i++) {
      const x = rand() * 220 - 110
      const z = rand() * 220 - 110
      if (onClearedGround(x, z, 4.2)) continue
      const depth = waterDepth(x, z)
      if (depth > 0.2) continue
      const y = terrainHeight(x, z)
      const slope = Math.abs(terrainHeight(x + 1.2, z) - y) + Math.abs(terrainHeight(x, z + 1.2) - y)
      if (slope > 2.2) continue
      const biome = biomeAt(x, z)
      const roll = rand()
      if ((biome.dominant === 'verdant' || biome.dominant === 'hub') && roll > 0.86 && trunks.length < 170) {
        const h = 2.4 + rand() * 2.6
        push(trunks, x, y + h * 0.5, z, 1, h / 2.4, 1)
        push(canopies, x, y + h + 0.55, z, 1.5 + rand() * 0.8, 1.2 + rand() * 0.5, 1.5 + rand() * 0.7)
      } else if ((biome.dominant === 'verdant' || biome.dominant === 'hub') && bushes.length < 260 && roll > 0.55) {
        push(bushes, x, y + 0.42, z, 0.8 + rand() * 0.7, 0.5 + rand() * 0.45, 0.8 + rand() * 0.55)
      } else if ((biome.dominant === 'verdant' || biome.dominant === 'hub') && grass.length < 2400) {
        push(grass, x, y + 0.32, z, 0.8 + rand() * 0.7, 0.6 + rand(), 0.8 + rand() * 0.6)
      } else if (biome.dominant === 'fen' && reeds.length < 780) {
        push(reeds, x, y + 0.7, z, 0.4, 0.9 + rand() * 0.8, 0.4)
      } else if (biome.dominant === 'neon' && plates.length < 220 && roll > 0.45) {
        push(plates, x, y + 0.08, z, 0.7 + rand(), 0.12, 0.7 + rand())
      } else if (biome.dominant === 'glass' && shards.length < 70 && roll > 0.72) {
        push(shards, x, y + 0.7, z, 0.45 + rand() * 0.8, 1.1 + rand() * 1.4, 0.45 + rand() * 0.7, rand() * 3)
      }
    }

    const add = (list: THREE.Object3D[], geo: THREE.BufferGeometry, material: THREE.Material, shadows = true) => {
      if (list.length === 0) return
      const mesh = new THREE.InstancedMesh(geo, material, list.length)
      mesh.castShadow = shadows
      mesh.receiveShadow = true
      list.forEach((item, i) => mesh.setMatrixAt(i, item.matrix))
      mesh.instanceMatrix.needsUpdate = true
      this.group.add(mesh)
      this.batches.push({ mesh, full: list.length, shadows })
    }

    const canopyMat = mat('#2f7d3c', { roughness: 0.82 })
    const bushMat = mat('#3f9344', { roughness: 0.88 })
    const grassMat = mat('#4ea03a', { roughness: 1 })
    const reedMat = mat('#8a8a58', { roughness: 1 })
    for (const [material, amount] of [
      [canopyMat, 0.06],
      [bushMat, 0.08],
      [grassMat, 0.4],
      [reedMat, 0.28],
    ] as const) {
      attachSway(material, amount)
      this.swayed.push(material)
    }

    add(trunks, cylGeo(0.18, 0.28, 2.4, 6), mat('#5c4030', { roughness: 0.92 }))
    add(canopies, new THREE.IcosahedronGeometry(1.15, 1), canopyMat)
    add(bushes, new THREE.IcosahedronGeometry(0.55, 0), bushMat, false)
    add(dead, cylGeo(0.08, 0.16, 2.2, 5), mat('#3a403c', { roughness: 1 }))
    add(poles, new THREE.OctahedronGeometry(0.55, 0), mat('#14181c', { metalness: 0.78, roughness: 0.22, emissive: '#14585e', emissiveIntensity: 0.85 }))
    add(stalks, cylGeo(0.05, 0.08, 2.1, 5), mat('#102024', { metalness: 0.6, roughness: 0.3, emissive: '#1ee0c8', emissiveIntensity: 0.7 }), false)
    add(grass, new THREE.ConeGeometry(0.16, 0.75, 4), grassMat, false)
    add(reeds, new THREE.ConeGeometry(0.05, 1.35, 3), reedMat, false)
    add(caps, new THREE.SphereGeometry(0.28, 6, 5), mat('#6e5a48', { roughness: 0.8, emissive: '#2a2018', emissiveIntensity: 0.2 }), false)
    add(rocks, new THREE.DodecahedronGeometry(0.45, 0), mat('#6e675e', { roughness: 0.95, flat: true }))
    add(shards, new THREE.OctahedronGeometry(0.7, 0), mat('#f4ead0', { roughness: 0.22, metalness: 0.2, emissive: '#f6e7c0', emissiveIntensity: 0.18, flat: true }))
    add(plates, new THREE.BoxGeometry(1.4, 0.08, 1.4), mat('#9ee8df', { metalness: 0.9, roughness: 0.16, emissive: '#0e4c50', emissiveIntensity: 0.7 }), false)

    tint(canopies.length, this.batches.find((b) => b.mesh.geometry.type === 'IcosahedronGeometry'))
    this.setQuality(quality)
  }

  update(time: number): void {
    for (const material of this.swayed) tickSway(material, time)
  }

  setQuality(quality: Quality): void {
    const scale = quality === 'low' ? 0.34 : quality === 'high' ? 1 : 0.72
    for (const batch of this.batches) {
      batch.mesh.count = Math.max(1, Math.floor(batch.full * scale))
      batch.mesh.castShadow = quality !== 'low' && batch.shadows
    }
  }
}

function tint(count: number, batch: Batch | undefined): void {
  if (!batch || count === 0) return
  const a = new THREE.Color('#246b30')
  const b = new THREE.Color('#4ea24a')
  const c = new THREE.Color('#1d5530')
  for (let i = 0; i < count; i++) {
    const pick = i % 3 === 0 ? a : i % 3 === 1 ? b : c
    batch.mesh.setColorAt(i, pick)
  }
  if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true
}
