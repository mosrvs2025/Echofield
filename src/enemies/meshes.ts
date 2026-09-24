import * as THREE from 'three'
import { addBox, mat, painted } from '../world/props.ts'
import type { Archetype } from './enemy.ts'

export interface EnemyVisual {
  root: THREE.Group
  materials: THREE.MeshStandardMaterial[]
  bar: THREE.Mesh
  bob: THREE.Object3D
}

export function buildEnemyMesh(kind: Archetype): EnemyVisual {
  const root = new THREE.Group()
  const bob = new THREE.Group()
  root.add(bob)
  const materials: THREE.MeshStandardMaterial[] = []
  const use = (m: THREE.MeshStandardMaterial) => {
    materials.push(m)
    return m
  }

  if (kind === 'stalker') {
    const hide = use(mat('#6ea84a', { roughness: 0.8 }))
    const limb = use(mat('#24301c'))
    addBox(bob, 0.7, 0.45, 0.95, hide, 0, 0.7, 0)
    bob.add(painted(new THREE.SphereGeometry(0.22, 7, 6), hide, 0, 0.95, -0.45))
    addBox(bob, 0.12, 0.4, 0.5, limb, -0.28, 0.55, -0.35)
    addBox(bob, 0.12, 0.4, 0.5, limb, 0.28, 0.55, -0.35)
    const eye = use(mat('#ff5a3c', { emissive: '#ff5a3c', emissiveIntensity: 1.4 }))
    bob.add(painted(new THREE.SphereGeometry(0.06, 6, 5), eye, -0.08, 1.0, -0.62))
    bob.add(painted(new THREE.SphereGeometry(0.06, 6, 5), eye, 0.08, 1.0, -0.62))
    const spine = use(mat('#d7e38a', { roughness: 0.55 }))
    for (let i = 0; i < 3; i++) {
      const spike = painted(new THREE.ConeGeometry(0.07, 0.42, 4), spine, -0.12 + i * 0.12, 1.05, 0.15 - i * 0.08)
      spike.rotation.x = -0.8
      bob.add(spike)
    }
  } else if (kind === 'brute') {
    const hide = use(mat('#6a4036', { roughness: 0.9 }))
    const horn = use(mat('#e6d7bf', { roughness: 0.45 }))
    addBox(bob, 1.15, 0.9, 0.7, hide, 0, 1.15, 0)
    bob.add(painted(new THREE.SphereGeometry(0.32, 8, 6), hide, 0, 1.75, -0.05))
    const left = painted(new THREE.ConeGeometry(0.12, 0.55, 4), horn, -0.2, 2.15, 0)
    const right = painted(new THREE.ConeGeometry(0.12, 0.55, 4), horn, 0.2, 2.15, 0)
    left.rotation.z = 0.4
    right.rotation.z = -0.4
    bob.add(left, right)
    addBox(bob, 0.42, 0.28, 0.42, hide, -0.72, 1.45, 0)
    addBox(bob, 0.42, 0.28, 0.42, hide, 0.72, 1.45, 0)
    addBox(bob, 0.28, 0.7, 0.28, hide, -0.7, 1.1, -0.1)
    addBox(bob, 0.28, 0.7, 0.28, hide, 0.7, 1.1, -0.1)
  } else {
    const shell = use(mat('#14181e', { metalness: 0.75, roughness: 0.25, emissive: '#0c2e32', emissiveIntensity: 0.5 }))
    const glow = use(mat('#39f2e2', { emissive: '#39f2e2', emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.3 }))
    const eye = use(mat('#ff4d8d', { emissive: '#ff4d8d', emissiveIntensity: 1.5 }))
    bob.add(painted(new THREE.OctahedronGeometry(0.42, 0), shell, 0, 0.2, 0))
    const ring = painted(new THREE.TorusGeometry(0.62, 0.045, 6, 14), glow, 0, 0.2, 0)
    ring.rotation.x = Math.PI / 2
    bob.add(ring)
    bob.add(painted(new THREE.SphereGeometry(0.1, 8, 6), eye, 0, 0.2, -0.28))
    const finL = painted(new THREE.OctahedronGeometry(0.22, 0), glow, -0.55, 0.2, 0)
    const finR = painted(new THREE.OctahedronGeometry(0.22, 0), glow, 0.55, 0.2, 0)
    finL.scale.set(0.45, 1.1, 0.7)
    finR.scale.set(0.45, 1.1, 0.7)
    bob.add(finL, finR)
  }

  const barBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.09),
    new THREE.MeshBasicMaterial({ color: '#1a120f' }),
  )
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.05),
    new THREE.MeshBasicMaterial({ color: '#d2c07a' }),
  )
  bar.position.z = 0.01
  barBg.add(bar)
  barBg.position.y = kind === 'brute' ? 2.5 : kind === 'drone' ? 1.15 : 1.55
  barBg.visible = false
  root.add(barBg)

  return { root, materials, bar, bob }
}
