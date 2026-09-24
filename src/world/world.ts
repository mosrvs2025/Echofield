import * as THREE from 'three'
import type { Quality } from '../core/settings.ts'
import type { AABB } from '../physics/colliders.ts'
import { biomeAt, biomeLook, type BiomeId } from './biomes.ts'
import { GrassField } from './grass.ts'
import { buildHorizon } from './horizon.ts'
import { buildStructures, type Interactable, type StructureKit } from './structures.ts'
import { buildTerrain } from './terrain.ts'
import { Vegetation } from './vegetation.ts'
import { Water } from './water.ts'

export class World {
  readonly group = new THREE.Group()
  readonly blocks: AABB[]
  readonly interactables: Interactable[]
  readonly water: Water
  readonly vegetation: Vegetation
  readonly grass: GrassField
  readonly look = {
    exposure: 1.05,
    contrast: 1.05,
    lift: new THREE.Vector3(0.01, 0.005, 0),
    gain: new THREE.Vector3(1, 1, 1),
  }
  private readonly structures: StructureKit
  private readonly sun: THREE.DirectionalLight
  private readonly fill: THREE.DirectionalLight
  private readonly rim: THREE.DirectionalLight
  private readonly hemi: THREE.HemisphereLight
  private readonly skyMat: THREE.ShaderMaterial
  private readonly fog: THREE.Fog
  private readonly skyColor = new THREE.Color()
  private readonly fogColor = new THREE.Color()
  private readonly sunColor = new THREE.Color()
  private readonly hemiColor = new THREE.Color()
  private readonly groundColor = new THREE.Color()
  private terrain: THREE.Mesh
  private sunPower = 2.4
  private fillPower = 0.4
  private fogNear = 36
  private fogFar = 120
  private readonly underFog = new THREE.Color('#0c4a52')
  private readonly liftTarget = new THREE.Vector3()
  private readonly gainTarget = new THREE.Vector3()

  constructor(scene: THREE.Scene, quality: Quality) {
    this.fog = new THREE.Fog('#e4d2b4', 36, 130)
    scene.fog = this.fog
    scene.add(this.group)

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#6ea4e4') },
        horizon: { value: new THREE.Color('#f0dcc0') },
        sunDir: { value: new THREE.Vector3(-0.42, 0.72, 0.32).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        void main() {
          vec3 n = normalize(vPos);
          float h = n.y;
          vec3 col = mix(horizon, top, smoothstep(-0.02, 0.62, h));
          float band = exp(-pow((h - 0.04) * 7.0, 2.0));
          col += band * horizon * 0.28;
          col = mix(horizon * 0.62, col, smoothstep(-0.35, 0.05, h));
          float sun = pow(max(dot(n, normalize(sunDir)), 0.0), 320.0);
          float glow = pow(max(dot(n, normalize(sunDir)), 0.0), 7.0);
          col += sun * vec3(1.0, 0.93, 0.72);
          col += glow * vec3(1.0, 0.72, 0.38) * 0.22;
          float cloud = sin(n.x * 6.0 + n.z * 4.2) * sin(n.z * 8.0 + n.x * 2.4);
          float cloud2 = sin(n.x * 14.0 - n.z * 9.0) * sin(n.z * 11.0 + n.x * 6.0);
          float puff = smoothstep(0.2, 0.82, cloud) * smoothstep(0.08, 0.55, h);
          float wisp = smoothstep(0.45, 0.9, cloud2) * smoothstep(0.2, 0.7, h);
          col = mix(col, min(col * 1.18 + vec3(0.08, 0.07, 0.05), vec3(1.2)), puff * 0.55);
          col = mix(col, col * 0.92 + vec3(0.05, 0.04, 0.03), wisp * 0.25);
          float cirrus = sin(n.x * 28.0 + n.z * 11.0) * sin(n.z * 22.0 - n.x * 8.0);
          float veil = smoothstep(0.55, 0.92, cirrus) * smoothstep(0.25, 0.7, h) * smoothstep(0.92, 0.55, h);
          col = mix(col, min(col + vec3(0.12, 0.1, 0.08), vec3(1.15)), veil * 0.35);
          float zenith = smoothstep(0.28, 0.95, h);
          col = mix(col, col * vec3(0.62, 0.72, 0.98), zenith * 0.42);
          float haze = exp(-max(h, 0.0) * 3.2);
          col = mix(col, horizon, haze * 0.45);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 28, 16), this.skyMat)
    this.group.add(sky)

    this.terrain = buildTerrain(segmentsFor(quality))
    this.group.add(this.terrain)
    this.water = new Water()
    this.group.add(this.water.group)
    this.vegetation = new Vegetation(quality)
    this.group.add(this.vegetation.group)
    this.grass = new GrassField(quality)
    this.group.add(this.grass.group)
    this.group.add(buildHorizon())
    this.structures = buildStructures()
    this.group.add(this.structures.group)

    this.blocks = [...this.structures.blocks, ...this.vegetation.blocks]
    this.interactables = this.structures.interactables

    this.hemi = new THREE.HemisphereLight('#d5e4ff', '#6d4c2e', 0.92)
    scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight('#fff1d0', 2.7)
    this.sun.position.set(-30, 48, 18)
    this.configureSun(quality)
    scene.add(this.sun, this.sun.target)
    this.fill = new THREE.DirectionalLight('#9eb7ff', 0.4)
    this.fill.position.set(24, 16, -14)
    scene.add(this.fill, this.fill.target)
    this.rim = new THREE.DirectionalLight('#d5e4ff', 0.32)
    this.rim.position.set(16, 10, -26)
    scene.add(this.rim, this.rim.target)
  }

  biomeAt(x: number, z: number): BiomeId {
    return biomeAt(x, z).dominant
  }

  setQuality(quality: Quality): void {
    this.vegetation.setQuality(quality)
    this.grass.setQuality(quality)
    this.configureSun(quality)
    this.group.remove(this.terrain)
    this.terrain.geometry.dispose()
    const material = this.terrain.material
    if (material instanceof THREE.Material) material.dispose()
    this.terrain = buildTerrain(segmentsFor(quality))
    this.group.add(this.terrain)
  }

  update(time: number, x: number, z: number, swimming: boolean, cam: THREE.Vector3): void {
    this.water.update(time, cam, this.skyColor)
    this.vegetation.update(time)
    this.grass.update(time, x, z)
    this.structures.fire.scale.setScalar(1 + Math.sin(time * 9) * 0.08)
    this.structures.fire.rotation.y = time * 0.6
    this.structures.stone.rotation.y = time * 0.35
    this.structures.needle.rotation.y = Math.sin(time * 0.4) * 0.06
    const beam = this.structures.needle.getObjectByName('needle-beam')
    if (beam) {
      const pulse = 1 + Math.sin(time * 2.2) * 0.06
      beam.scale.set(pulse, 1, pulse)
    }
    const tip = this.structures.needle.getObjectByName('needle-tip')
    if (tip) tip.position.y = 16.4 + Math.sin(time * 1.6) * 0.18

    const air = biomeLook(x, z)
    this.fogColor.setRGB(air.fog[0], air.fog[1], air.fog[2])
    this.skyColor.setRGB(air.sky[0], air.sky[1], air.sky[2])
    this.sunColor.setRGB(air.sun[0], air.sun[1], air.sun[2])
    this.hemiColor.setRGB(air.hemi[0], air.hemi[1], air.hemi[2])
    this.groundColor.setRGB(air.ground[0], air.ground[1], air.ground[2])
    const underwater = swimming || cam.y < 1.15
    if (underwater) {
      this.fogColor.lerp(this.underFog, 0.62)
      this.fogNear = 3.5
      this.fogFar = 36
    } else {
      this.fogNear += (air.fogNear - this.fogNear) * 0.06
      this.fogFar += (air.fogFar - this.fogFar) * 0.06
    }
    this.fog.color.lerp(this.fogColor, 0.08)
    this.fog.near = this.fogNear
    this.fog.far = this.fogFar
    const top = this.skyMat.uniforms.top!.value as THREE.Color
    const horizon = this.skyMat.uniforms.horizon!.value as THREE.Color
    top.lerp(this.skyColor, 0.05)
    horizon.lerp(this.fog.color, 0.08)
    this.sun.color.lerp(this.sunColor, 0.05)
    this.hemi.color.lerp(this.hemiColor, 0.05)
    this.hemi.groundColor.lerp(this.groundColor, 0.05)
    this.sunPower += (air.sunPower - this.sunPower) * 0.05
    this.fillPower += (air.fill - this.fillPower) * 0.05
    this.sun.intensity = underwater ? this.sunPower * 0.35 : this.sunPower
    this.fill.intensity = underwater ? 0.08 : this.fillPower
    this.hemi.intensity = underwater ? 0.28 : 0.95
    this.look.exposure += ((underwater ? 0.72 : air.exposure) - this.look.exposure) * 0.05
    this.look.contrast += (air.contrast - this.look.contrast) * 0.05
    this.liftTarget.set(air.lift[0], air.lift[1], air.lift[2])
    this.gainTarget.set(air.gain[0], air.gain[1], air.gain[2])
    this.look.lift.lerp(this.liftTarget, 0.05)
    this.look.gain.lerp(this.gainTarget, 0.05)

    this.sun.position.set(x - 42, 32, z + 24)
    this.sun.target.position.set(x, 0, z)
    this.sun.target.updateMatrixWorld()
    this.fill.position.set(x + 22, 18, z - 16)
    this.fill.target.position.set(x, 1, z)
    this.fill.target.updateMatrixWorld()
    this.rim.position.set(x + 28, 9, z - 22)
    this.rim.target.position.set(x, 1.4, z)
    this.rim.intensity = underwater ? 0.05 : 0.32
    this.rim.target.updateMatrixWorld()
  }

  private configureSun(quality: Quality): void {
    const shadows = quality !== 'low'
    this.sun.castShadow = shadows
    const compact = typeof window !== 'undefined' && window.innerWidth < 900
    const map = quality === 'high' && !compact ? 2048 : 1024
    this.sun.shadow.mapSize.set(map, map)
    this.sun.shadow.radius = quality === 'high' ? 2.4 : 1.4
    this.sun.shadow.camera.near = 4
    this.sun.shadow.camera.far = quality === 'high' ? 140 : 96
    const span = quality === 'high' ? 42 : 30
    this.sun.shadow.camera.left = -span
    this.sun.shadow.camera.right = span
    this.sun.shadow.camera.top = span
    this.sun.shadow.camera.bottom = -span
    this.sun.shadow.bias = -0.00025
    this.sun.shadow.normalBias = 0.035
    const shadow = this.sun.shadow.map
    if (shadow) {
      shadow.dispose()
      this.sun.shadow.map = null
    }
  }
}

function segmentsFor(quality: Quality): number {
  if (quality === 'low') return 72
  if (quality === 'high') return 148
  return 112
}
