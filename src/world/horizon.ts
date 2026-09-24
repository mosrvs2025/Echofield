import * as THREE from 'three'
import { mulberry32 } from '../core/math.ts'
import { terrainHeight } from '../physics/heightfield.ts'
import { LAYOUT } from './layout.ts'

/** Distant ridges inside the fog. Visual only — they do not collide. */
export function buildHorizon(): THREE.Group {
  const group = new THREE.Group()
  const rand = mulberry32(41)
  const geo = new THREE.ConeGeometry(1, 1, 5)
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    vertexColors: true,
  })
  const mesh = new THREE.InstancedMesh(geo, material, 36)
  mesh.castShadow = false
  mesh.receiveShadow = false
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let n = 0
  for (let i = 0; i < 52 && n < 36; i++) {
    const angle = (i / 52) * Math.PI * 2
    const radius = 92 + rand() * 18
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (Math.hypot(x - LAYOUT.needle.x, z - LAYOUT.needle.z) < 26) continue
    if (Math.hypot(x - LAYOUT.camp.x, z - LAYOUT.camp.z) < 18) continue
    const height = 16 + rand() * 28
    const width = 6 + rand() * 8
    const y = terrainHeight(x, z)
    dummy.position.set(x, y + height * 0.42, z)
    dummy.scale.set(width, height, width * (0.75 + rand() * 0.4))
    dummy.rotation.set(0, rand() * 6, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(n, dummy.matrix)
    color.setHSL(0.07 + rand() * 0.05, 0.16 + rand() * 0.08, 0.38 + rand() * 0.14)
    mesh.setColorAt(n, color)
    n++
  }
  mesh.count = Math.max(1, n)
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  group.add(mesh)
  return group
}
