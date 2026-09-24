import * as THREE from 'three'
import { LAYOUT } from './layout.ts'

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin(p.x * 0.42 + uTime * 1.25) * 0.055 + cos(p.z * 0.31 - uTime * 0.85) * 0.04;
    p.y += wave;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uShape;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    float edge;
    if (uShape < 0.5) {
      vec2 p = vUv * 2.0 - 1.0;
      float d = length(p);
      edge = smoothstep(1.0, 0.62, d);
    } else {
      float bank = smoothstep(0.5, 0.18, abs(vUv.x - 0.5));
      float ends = smoothstep(0.5, 0.38, abs(vUv.y - 0.5));
      edge = bank * ends;
    }
    vec3 viewDir = normalize(uCam - vWorld);
    float fres = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.4);
    float ripple = sin(vWorld.x * 1.6 + uTime * 1.7) * sin(vWorld.z * 1.25 - uTime * 1.1);
    float ripple2 = sin(vWorld.x * 4.8 - uTime * 2.1) * sin(vWorld.z * 3.7 + uTime * 1.6);
    vec3 col = mix(uDeep, uShallow, 0.38 + ripple * 0.1 + ripple2 * 0.05);
    col = mix(col * 0.82, col, edge);
    col = mix(col, uSky * vec3(0.85, 0.92, 0.95), fres * 0.78);
    float glint = pow(max(sin(vWorld.x * 3.1 + uTime * 2.4) * sin(vWorld.z * 2.6 - uTime * 1.8), 0.0), 8.0);
    float glint2 = pow(max(sin(vWorld.x * 8.4 - uTime * 3.2) * sin(vWorld.z * 7.1 + uTime * 2.6), 0.0), 14.0);
    col += vec3(0.85, 0.95, 0.9) * glint * fres * 0.55;
    col += vec3(1.0, 0.98, 0.9) * glint2 * fres * 0.35;
    col += vec3(0.2, 0.28, 0.26) * fres * fres;
    float shore = smoothstep(0.12, 0.38, edge) * (1.0 - smoothstep(0.38, 0.7, edge));
    float foamNoise = sin(vWorld.x * 2.8 + uTime * 2.4) * sin(vWorld.z * 2.1 - uTime * 1.7);
    float foam = max(shore, smoothstep(0.42, 0.92, foamNoise) * shore * 1.8);
    col = mix(col, vec3(0.9, 0.97, 0.95), clamp(foam, 0.0, 1.0));
    float alpha = edge * (0.72 + fres * 0.22);
    gl_FragColor = vec4(col, alpha);
  }
`

function makeMaterial(deep: string, shallow: string, shape: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uSky: { value: new THREE.Color('#d7e6f2') },
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uShape: { value: shape },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  })
}

export class Water {
  readonly group = new THREE.Group()
  private materials: THREE.ShaderMaterial[] = []

  constructor() {
    this.addDisc(LAYOUT.lake.x, LAYOUT.lake.z, LAYOUT.lake.rx, LAYOUT.lake.rz, LAYOUT.lake.surface, '#0c4c58', '#1f8f96', 32)
    const canal = LAYOUT.canal
    const canalGeo = new THREE.PlaneGeometry(canal.hx * 2, canal.hz * 2, 18, 28)
    canalGeo.rotateX(-Math.PI / 2)
    const canalMat = makeMaterial('#0e5560', '#3ec8c4', 1)
    const canalMesh = new THREE.Mesh(canalGeo, canalMat)
    canalMesh.position.set(canal.x, canal.surface + 0.04, canal.z)
    canalMesh.renderOrder = 2
    this.group.add(canalMesh)
    this.materials.push(canalMat)
    this.addDisc(LAYOUT.fen.x, LAYOUT.fen.z, LAYOUT.fen.rx, LAYOUT.fen.rz, LAYOUT.fen.surface, '#121c18', '#3d5a48', 24)
  }

  private addDisc(x: number, z: number, rx: number, rz: number, surface: number, deep: string, shallow: string, seg: number): void {
    const geo = new THREE.CircleGeometry(1, seg)
    geo.rotateX(-Math.PI / 2)
    const material = makeMaterial(deep, shallow, 0)
    const mesh = new THREE.Mesh(geo, material)
    mesh.scale.set(rx, 1, rz)
    mesh.position.set(x, surface + 0.04, z)
    mesh.renderOrder = 2
    this.group.add(mesh)
    this.materials.push(material)
  }

  update(time: number, cam: THREE.Vector3, sky: THREE.Color): void {
    for (const material of this.materials) {
      material.uniforms.uTime!.value = time
      ;(material.uniforms.uCam!.value as THREE.Vector3).copy(cam)
      ;(material.uniforms.uSky!.value as THREE.Color).copy(sky)
    }
  }
}
