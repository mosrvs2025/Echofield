import * as THREE from 'three'

export function labelTexture(lines: string[], fg = '#1a1612', bg = '#e7d7b4'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    return fallback
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#2a241c'
  ctx.lineWidth = 12
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 54px Palatino, Georgia, serif'
  lines.forEach((line, i) => {
    const y = canvas.height / 2 + (i - (lines.length - 1) / 2) * 64
    ctx.fillText(line, canvas.width / 2, y)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function signBoard(lines: string[], w = 1.8, h = 0.9): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h)
  const material = new THREE.MeshStandardMaterial({
    map: labelTexture(lines),
    roughness: 0.85,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  return mesh
}
