import * as THREE from 'three'

export function mat(
  color: string,
  opts: {
    roughness?: number
    metalness?: number
    emissive?: string
    emissiveIntensity?: number
    flat?: boolean
    transparent?: boolean
    opacity?: number
  } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.86,
    metalness: opts.metalness ?? 0.04,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    flatShading: opts.flat ?? false,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
}

export function painted(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const boxes = new Map<string, THREE.BoxGeometry>()
const cyls = new Map<string, THREE.CylinderGeometry>()

export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w}x${h}x${d}`
  let geo = boxes.get(key)
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d)
    boxes.set(key, geo)
  }
  return geo
}

export function cylGeo(rt: number, rb: number, h: number, seg = 6): THREE.CylinderGeometry {
  const key = `${rt}_${rb}_${h}_${seg}`
  let geo = cyls.get(key)
  if (!geo) {
    geo = new THREE.CylinderGeometry(rt, rb, h, seg)
    cyls.set(key, geo)
  }
  return geo
}

export function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = painted(boxGeo(w, h, d), material, x, y, z)
  parent.add(mesh)
  return mesh
}
