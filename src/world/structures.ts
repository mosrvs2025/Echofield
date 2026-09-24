import * as THREE from 'three'
import { aabb, type AABB } from '../physics/colliders.ts'
import { terrainHeight } from '../physics/heightfield.ts'
import { LAYOUT } from './layout.ts'
import { addBox, cylGeo, mat, painted } from './props.ts'
import { signBoard } from './signs.ts'

export interface Interactable {
  id: string
  kind: 'keeper' | 'seamstone' | 'needle'
  x: number
  z: number
  radius: number
  prompt: string
  name: string
}

export interface StructureKit {
  group: THREE.Group
  blocks: AABB[]
  interactables: Interactable[]
  fire: THREE.Object3D
  stone: THREE.Object3D
  needle: THREE.Object3D
}

export function buildStructures(): StructureKit {
  const group = new THREE.Group()
  const blocks: AABB[] = []
  const yAt = (x: number, z: number) => terrainHeight(x, z)

  const fire = buildCamp(group, blocks, yAt)
  const stone = buildSeamstone(group, blocks, yAt)
  buildThornCamp(group, blocks, yAt)
  const needle = buildNeedle(group, blocks, yAt)
  buildBridge(group, blocks, yAt)
  buildArches(group, blocks, yAt)
  buildVistas(group, yAt)

  const interactables: Interactable[] = [
    {
      id: 'keeper',
      kind: 'keeper',
      x: LAYOUT.keeper.x,
      z: LAYOUT.keeper.z,
      radius: 2.4,
      prompt: 'Speak with Keeper Bram',
      name: 'Keeper Bram',
    },
    {
      id: 'seamstone',
      kind: 'seamstone',
      x: LAYOUT.stone.x,
      z: LAYOUT.stone.z,
      radius: 2.7,
      prompt: 'Rest at the Seamstone',
      name: 'Seamstone',
    },
    {
      id: 'needle',
      kind: 'needle',
      x: LAYOUT.needle.x,
      z: LAYOUT.needle.z,
      radius: 3.2,
      prompt: 'Listen to the Chrome Needle',
      name: 'Chrome Needle',
    },
  ]

  return { group, blocks, interactables, fire, stone, needle }
}

function buildCamp(
  group: THREE.Group,
  blocks: AABB[],
  yAt: (x: number, z: number) => number,
): THREE.Object3D {
  const y = yAt(0, 0)
  const ring = painted(new THREE.TorusGeometry(0.85, 0.12, 5, 10), mat('#3a322c'), 0, y + 0.15, 0)
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  const logMat = mat('#6a4a32')
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const log = painted(cylGeo(0.1, 0.1, 1.1, 5), logMat, Math.cos(a) * 0.35, y + 0.28, Math.sin(a) * 0.35)
    log.rotation.z = Math.PI / 2
    log.rotation.y = a
    group.add(log)
  }
  const fire = new THREE.Group()
  const flame = painted(new THREE.ConeGeometry(0.28, 0.7, 5), mat('#ff8a3a', { emissive: '#ff6a1a', emissiveIntensity: 1.4, roughness: 0.4 }), 0, 0.45, 0)
  const core = painted(new THREE.ConeGeometry(0.14, 0.45, 4), mat('#ffe1a0', { emissive: '#ffd27a', emissiveIntensity: 2 }), 0, 0.4, 0)
  flame.castShadow = false
  core.castShadow = false
  fire.add(flame, core)
  fire.position.set(0, y + 0.2, 0)
  group.add(fire)
  const light = new THREE.PointLight('#ff8a3c', 10, 16, 2)
  light.position.set(0, y + 1.4, 0)
  group.add(light)

  const tentCloth = mat('#8d4a3a', { roughness: 0.9 })
  const tentDark = mat('#5c3028')
  const tents: [number, number, number][] = [
    [-7.2, -3.2, 0.4],
    [7.4, -4.2, 2.2],
    [-1.5, -7.4, 1.1],
  ]
  for (const [x, z, rot] of tents) {
    const ty = yAt(x, z)
    const tent = new THREE.Group()
    const cone = painted(new THREE.ConeGeometry(1.7, 2.1, 4), tentCloth, 0, 1.15, 0)
    const flap = addBox(tent, 0.9, 1.1, 0.08, tentDark, 0, 0.55, 1.15)
    flap.rotation.x = -0.4
    tent.add(cone)
    tent.position.set(x, ty, z)
    tent.rotation.y = rot
    group.add(tent)
    blocks.push(aabb(x, ty + 1, z, 1.15, 1.15, 1.15))
  }

  const crateMat = mat('#7a6244')
  const crates: [number, number, number][] = [
    [5.2, 2.4, 0.7],
    [6.1, 3.1, 0.45],
  ]
  for (const [x, z, s] of crates) {
    const cy = yAt(x, z)
    addBox(group, s, s, s, crateMat, x, cy + s * 0.5, z)
    blocks.push(aabb(x, cy + s * 0.5, z, s * 0.5, s * 0.5, s * 0.5))
  }

  const keeper = buildFigure(mat('#355f56'), mat('#e0b896'), mat('#c4a574'))
  const ky = yAt(LAYOUT.keeper.x, LAYOUT.keeper.z)
  keeper.position.set(LAYOUT.keeper.x, ky, LAYOUT.keeper.z)
  const staff = painted(cylGeo(0.04, 0.05, 2.1, 5), mat('#6d5438'), 0.35, 1.05, 0.1)
  keeper.add(staff)
  group.add(keeper)
  blocks.push(aabb(LAYOUT.keeper.x, ky + 0.9, LAYOUT.keeper.z, 0.4, 0.9, 0.4))

  const post = painted(cylGeo(0.08, 0.1, 2.2, 5), mat('#4a3b2e'), -2.4, yAt(-2.4, 6.4) + 1.1, 6.4)
  group.add(post)
  const board = signBoard(['Verdant Rift  \u2190', '\u2192  Neon Vein'])
  board.position.set(-2.4, yAt(-2.4, 6.4) + 2.15, 6.4)
  group.add(board)
  blocks.push(aabb(-2.4, yAt(-2.4, 6.4) + 1, 6.4, 0.2, 1.1, 0.2))

  return fire
}

function buildFigure(cloth: THREE.Material, skin: THREE.Material, trim: THREE.Material): THREE.Group {
  const fig = new THREE.Group()
  addBox(fig, 0.46, 0.62, 0.28, cloth, 0, 1.15, 0)
  addBox(fig, 0.5, 0.18, 0.32, trim, 0, 0.82, 0)
  const head = painted(new THREE.SphereGeometry(0.2, 8, 6), skin, 0, 1.62, 0)
  fig.add(head)
  addBox(fig, 0.12, 0.48, 0.12, cloth, -0.18, 0.42, 0)
  addBox(fig, 0.12, 0.48, 0.12, cloth, 0.18, 0.42, 0)
  return fig
}

function buildSeamstone(group: THREE.Group, blocks: AABB[], yAt: (x: number, z: number) => number): THREE.Object3D {
  const x = LAYOUT.stone.x
  const z = LAYOUT.stone.z
  const y = yAt(x, z)
  const stone = new THREE.Group()
  const crystal = painted(
    new THREE.OctahedronGeometry(0.7, 0),
    mat('#d7fff4', { emissive: '#7dffe2', emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.1 }),
    0,
    1.7,
    0,
  )
  const shard = painted(
    new THREE.OctahedronGeometry(0.35, 0),
    mat('#9fffea', { emissive: '#bffff0', emissiveIntensity: 1.2, roughness: 0.15 }),
    0.2,
    2.5,
    0,
  )
  const base = painted(cylGeo(0.55, 0.7, 0.4, 6), mat('#5c675f'), 0, 0.25, 0)
  stone.add(crystal, shard, base)
  stone.position.set(x, y, z)
  group.add(stone)
  const beam = painted(
    cylGeo(0.08, 0.2, 7, 5),
    mat('#d8fff6', { emissive: '#9dffe8', emissiveIntensity: 0.7, transparent: true, opacity: 0.22, roughness: 0.2 }),
    x,
    y + 4.2,
    z,
  )
  beam.castShadow = false
  group.add(beam)
  const light = new THREE.PointLight('#9dffe8', 8, 14, 2)
  light.position.set(x, y + 2.2, z)
  group.add(light)
  blocks.push(aabb(x, y + 0.6, z, 0.45, 0.7, 0.45))
  return stone
}

function buildThornCamp(group: THREE.Group, blocks: AABB[], yAt: (x: number, z: number) => number): void {
  const cx = LAYOUT.camp.x
  const cz = LAYOUT.camp.z
  const y = yAt(cx, cz)
  const stone = mat('#6d7264', { roughness: 0.95 })
  const moss = mat('#3e6a38')
  for (let i = 0; i < 6; i++) {
    if (i === 0) continue
    const a = (i / 6) * Math.PI * 2
    const x = cx + Math.cos(a) * 6.2
    const z = cz + Math.sin(a) * 6.2
    const h = i % 2 === 0 ? 2.6 : 1.5
    const py = yAt(x, z)
    const pillar = painted(cylGeo(0.38, 0.5, h, 6), i % 3 === 0 ? moss : stone, x, py + h * 0.5, z)
    group.add(pillar)
    blocks.push(aabb(x, py + h * 0.5, z, 0.48, h * 0.5, 0.48))
  }
  const wall = addBox(group, 3.2, 1.1, 0.45, stone, cx - 2, y + 0.55, cz + 6.4)
  blocks.push(aabb(wall.position.x, wall.position.y, wall.position.z, 1.6, 0.55, 0.28))
  const banner = painted(
    new THREE.PlaneGeometry(0.9, 1.3),
    mat('#7d2e2e', { roughness: 0.7, emissive: '#3a1010', emissiveIntensity: 0.3 }),
    cx + 4.5,
    y + 2.1,
    cz - 1,
  )
  group.add(banner)
  const pole = painted(cylGeo(0.05, 0.06, 2.6, 5), mat('#3a332c'), cx + 4.5, y + 1.3, cz - 1)
  group.add(pole)
}

function buildNeedle(group: THREE.Group, blocks: AABB[], yAt: (x: number, z: number) => number): THREE.Object3D {
  const x = LAYOUT.needle.x
  const z = LAYOUT.needle.z
  const y = yAt(x, z)
  const needle = new THREE.Group()
  const metal = mat('#b7c3cc', { metalness: 0.88, roughness: 0.18, emissive: '#12343c', emissiveIntensity: 0.55 })
  const glow = mat('#5dfff0', { emissive: '#39f0e0', emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.18 })
  const mag = mat('#ff4d8d', { emissive: '#ff4d8d', emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.25 })
  for (let i = 0; i < 7; i++) {
    const h = 2.2
    const r = 0.95 - i * 0.1
    const seg = painted(cylGeo(Math.max(0.12, r * 0.62), r, h, 8), metal, 0, i * 2.05 + 1.1, 0)
    needle.add(seg)
  }
  const ringA = painted(new THREE.TorusGeometry(2.1, 0.08, 8, 24), glow, 0, 5.4, 0)
  ringA.rotation.x = Math.PI / 2
  const ringB = painted(new THREE.TorusGeometry(1.25, 0.055, 8, 20), mag, 0, 10.2, 0)
  ringB.rotation.x = Math.PI / 2.5
  const tip = painted(new THREE.OctahedronGeometry(0.55, 0), glow, 0, 16.4, 0)
  tip.name = 'needle-tip'
  const beamMat = mat('#7dfff2', {
    emissive: '#39f0e0',
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
  })
  const beam = painted(cylGeo(0.22, 0.55, 14, 8), beamMat, 0, 7.2, 0)
  beam.name = 'needle-beam'
  beam.castShadow = false
  const pad = painted(new THREE.CylinderGeometry(2.4, 2.6, 0.16, 8), metal, 0, 0.1, 0)
  needle.add(ringA, ringB, tip, beam, pad)
  needle.position.set(x, y, z)
  group.add(needle)
  const light = new THREE.PointLight('#39f0e0', 28, 36, 2)
  light.position.set(x, y + 9, z)
  group.add(light)
  const crown = new THREE.PointLight('#ff4d8d', 8, 14, 2)
  crown.position.set(x, y + 15, z)
  group.add(crown)
  blocks.push(aabb(x, y + 2, z, 0.9, 2.2, 0.9))

  const wreck = mat('#2c3138', { metalness: 0.6, roughness: 0.35 })
  const scraps: [number, number][] = [
    [x - 8, z + 4],
    [x + 6, z - 5],
    [x - 4, z - 6],
    [70, -5],
    [34, 3],
  ]
  for (const [sx, sz] of scraps) {
    const sy = yAt(sx, sz)
    const box = addBox(group, 1.6, 1.1, 0.9, wreck, sx, sy + 0.55, sz)
    box.rotation.y = sx * 0.2
    blocks.push(aabb(sx, sy + 0.55, sz, 0.85, 0.55, 0.5))
  }
  return needle
}

function buildBridge(group: THREE.Group, blocks: AABB[], _yAt: (x: number, z: number) => number): void {
  const x = LAYOUT.bridge.x
  const z = LAYOUT.bridge.z
  const top = LAYOUT.bridge.top
  const deckMat = mat('#6e5538', { roughness: 0.9 })
  addBox(group, 18, 0.22, 3.4, deckMat, x, top - 0.11, z)
  blocks.push(aabb(x, top - 0.11, z, 9, 0.11, 1.7))
  const post = mat('#3e342c')
  for (const [dx, dz] of [
    [-7.2, 1.5],
    [-7.2, -1.5],
    [7.2, 1.5],
    [7.2, -1.5],
  ] as const) {
    const p = painted(cylGeo(0.12, 0.14, 1.3, 5), post, x + dx, top + 0.4, z + dz)
    group.add(p)
  }
}

function buildArches(group: THREE.Group, blocks: AABB[], yAt: (x: number, z: number) => number): void {
  const stone = mat('#7d846c')
  placeArch(group, blocks, -22, 0, yAt(-22, 0), stone, 1)
  const metal = mat('#22262c', { metalness: 0.75, roughness: 0.3, emissive: '#1a0a18', emissiveIntensity: 0.4 })
  placeArch(group, blocks, 30, 2, yAt(30, 2), metal, 0.85)
  const rib = mat('#d9d0bf', { roughness: 0.4 })
  placeArch(group, blocks, LAYOUT.saltSpire.x, LAYOUT.saltSpire.z, yAt(LAYOUT.saltSpire.x, LAYOUT.saltSpire.z), rib, 1.4)
}

function placeArch(
  group: THREE.Group,
  blocks: AABB[],
  x: number,
  z: number,
  y: number,
  material: THREE.Material,
  scale: number,
): void {
  const h = 2.6 * scale
  const gap = 1.6 * scale
  const left = addBox(group, 0.45 * scale, h, 0.45 * scale, material, x - gap, y + h * 0.5, z)
  const right = addBox(group, 0.45 * scale, h, 0.45 * scale, material, x + gap, y + h * 0.5, z)
  addBox(group, gap * 2 + 0.4, 0.35 * scale, 0.4 * scale, material, x, y + h, z)
  blocks.push(aabb(left.position.x, left.position.y, left.position.z, 0.3 * scale, h * 0.5, 0.3 * scale))
  blocks.push(aabb(right.position.x, right.position.y, right.position.z, 0.3 * scale, h * 0.5, 0.3 * scale))
}

function buildVistas(group: THREE.Group, yAt: (x: number, z: number) => number): void {
  const x = LAYOUT.boneArch.x
  const z = LAYOUT.boneArch.z
  const y = yAt(x, z)
  const bone = mat('#cfc6b4', { roughness: 0.55 })
  const left = painted(cylGeo(0.12, 0.2, 4.5, 5), bone, x - 1.4, y + 2, z)
  left.rotation.z = 0.25
  const right = painted(cylGeo(0.12, 0.2, 4.5, 5), bone, x + 1.4, y + 2, z)
  right.rotation.z = -0.25
  group.add(left, right)
  const spireMat = mat('#f3ead2', { roughness: 0.25, metalness: 0.12, emissive: '#f6e7c4', emissiveIntensity: 0.15 })
  for (let i = 0; i < 3; i++) {
    const sx = LAYOUT.saltSpire.x + i * 3.2 - 2
    const sz = LAYOUT.saltSpire.z + (i - 1) * 2
    const sy = yAt(sx, sz)
    const spire = painted(new THREE.OctahedronGeometry(0.7 + i * 0.15, 0), spireMat, sx, sy + 2 + i, sz)
    spire.scale.y = 2.4
    group.add(spire)
  }
}
