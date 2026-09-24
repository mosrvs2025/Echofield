import * as THREE from 'three'
import { hash2 } from '../core/math.ts'
import type { Quality } from '../core/settings.ts'
import { terrainHeight, waterDepth } from '../physics/heightfield.ts'
import { biomeAt } from './biomes.ts'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

interface SwayShader {
  uniforms: { uTime: { value: number } }
}

export function attachSway(material: THREE.MeshStandardMaterial, amount: number, tips = false): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uSway = { value: amount }
    material.userData.sway = shader
    const bladeVary = tips ? 'varying float vBlade;\n' : ''
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uSway;\n${bladeVary}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
          #include <begin_vertex>
          vec3 inst = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float h = clamp(position.y, 0.0, 2.0);
          ${tips ? 'vBlade = h;' : ''}
          float w = sin(uTime * 1.65 + inst.x * 0.62 + inst.z * 0.41) * h * uSway;
          transformed.x += w;
          transformed.z += cos(uTime * 1.2 + inst.z * 0.73) * h * uSway * 0.62;
        `,
      )
    if (tips) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${bladeVary}`)
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
            #include <color_fragment>
            float tip = smoothstep(0.05, 0.9, vBlade);
            diffuseColor.rgb = mix(diffuseColor.rgb * 0.72, diffuseColor.rgb * vec3(1.15, 1.28, 0.82), tip);
          `,
        )
    }
  }
  material.customProgramCacheKey = () => `sway-${amount}-${tips ? 'tip' : 'plain'}`
}

export function tickSway(material: THREE.Material, time: number): void {
  const shader = material.userData.sway as SwayShader | undefined
  if (shader) shader.uniforms.uTime.value = time
}

function bladeGeometry(): THREE.BufferGeometry {
  const card = () => {
    const geo = new THREE.PlaneGeometry(0.13, 0.98, 1, 3)
    geo.translate(0, 0.46, 0)
    const pos = geo.attributes.position
    if (!pos) throw new Error('grass blade missing position')
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      pos.setZ(i, pos.getZ(i) + y * y * 0.18)
    }
    return geo
  }
  const a = card()
  const b = card()
  b.rotateY(Math.PI / 2)
  const geo = mergeGeometries([a, b])
  if (!geo) throw new Error('grass blade merge failed')
  const pos = geo.attributes.position
  if (!pos) throw new Error('grass blade missing position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, pos.getY(i) / 0.92)
    colors[i * 3] = 0.12 + t * 0.28
    colors[i * 3 + 1] = 0.32 + t * 0.48
    colors[i * 3 + 2] = 0.06 + t * 0.04
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function budget(quality: Quality): { capacity: number; spacing: number; radius: number } {
  if (quality === 'low') return { capacity: 640, spacing: 0.98, radius: 9 }
  if (quality === 'high') return { capacity: 5200, spacing: 0.42, radius: 18 }
  return { capacity: 2400, spacing: 0.55, radius: 14 }
}

export class GrassField {
  readonly group = new THREE.Group()
  private mesh: THREE.InstancedMesh
  private readonly material: THREE.MeshStandardMaterial
  private readonly dummy = new THREE.Object3D()
  private readonly color = new THREE.Color()
  private quality: Quality
  private anchorX = 1e9
  private anchorZ = 1e9

  constructor(quality: Quality) {
    this.quality = quality
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    attachSway(this.material, 0.48, true)
    this.mesh = this.makeMesh(budget(quality).capacity)
    this.group.add(this.mesh)
  }

  setQuality(quality: Quality): void {
    if (quality === this.quality) return
    this.quality = quality
    this.group.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.dispose()
    this.mesh = this.makeMesh(budget(quality).capacity)
    this.group.add(this.mesh)
    this.anchorX = 1e9
  }

  update(time: number, x: number, z: number): void {
    tickSway(this.material, time)
    const { spacing } = budget(this.quality)
    const ax = Math.floor(x / spacing)
    const az = Math.floor(z / spacing)
    if (ax === this.anchorX && az === this.anchorZ) return
    this.anchorX = ax
    this.anchorZ = az
    this.scatter(x, z)
  }

  private makeMesh(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(bladeGeometry(), this.material, capacity)
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.count = 0
    return mesh
  }

  private scatter(x: number, z: number): void {
    const { capacity, spacing, radius } = budget(this.quality)
    const reach = Math.ceil(radius / spacing)
    const cx = Math.floor(x / spacing)
    const cz = Math.floor(z / spacing)
    let n = 0
    const r2 = radius * radius
    for (let ix = cx - reach; ix <= cx + reach && n < capacity; ix++) {
      for (let iz = cz - reach; iz <= cz + reach && n < capacity; iz++) {
        const gx = ix * spacing
        const gz = iz * spacing
        const hx = hash2(Math.floor(gx * 10), Math.floor(gz * 10))
        const hz = hash2(Math.floor(gz * 10) + 19, Math.floor(gx * 10) - 3)
        const px = gx + (hx - 0.5) * spacing * 0.85
        const pz = gz + (hz - 0.5) * spacing * 0.85
        const dx = px - x
        const dz = pz - z
        if (dx * dx + dz * dz > r2) continue
        if (Math.hypot(px, pz) < 6.5) continue
        const depth = waterDepth(px, pz)
        if (depth > 0.05) continue
        const y = terrainHeight(px, pz)
        const slope = Math.abs(terrainHeight(px + 0.8, pz) - y) + Math.abs(terrainHeight(px, pz + 0.8) - y)
        if (slope > 1.35) continue
        const biome = biomeAt(px, pz)
        const h = 0.65 + hz * 0.85
        this.dummy.position.set(px, y, pz)
        this.dummy.rotation.set(0, hx * Math.PI * 2, 0)
        this.dummy.scale.set(0.75 + hx * 0.5, h, 0.75 + hz * 0.45)
        this.dummy.updateMatrix()
        this.mesh.setMatrixAt(n, this.dummy.matrix)
        this.tint(biome.dominant, hx, n)
        n++
      }
    }
    this.mesh.count = Math.max(1, n)
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  private tint(biome: string, hue: number, index: number): void {
    if (biome === 'fen') this.color.setRGB(0.32 + hue * 0.08, 0.34, 0.18)
    else if (biome === 'neon') this.color.setRGB(0.15, 0.55 + hue * 0.3, 0.48)
    else if (biome === 'glass') this.color.setRGB(0.72, 0.66, 0.32)
    else if (biome === 'hub') this.color.setRGB(0.55 + hue * 0.15, 0.62, 0.22)
    else this.color.setRGB(0.22 + hue * 0.12, 0.72 + hue * 0.2, 0.18)
    this.mesh.setColorAt(index, this.color)
  }
}
