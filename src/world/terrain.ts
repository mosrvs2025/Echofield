import * as THREE from 'three'
import { clamp, hash2 } from '../core/math.ts'
import { biomeColor } from './biomes.ts'
import { terrainHeight, waterDepth } from '../physics/heightfield.ts'

export function buildTerrain(segments = 112): THREE.Mesh {
  const size = 240
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  if (!pos) throw new Error('terrain geometry missing position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = terrainHeight(x, z)
    const grain = (hash2(Math.floor(x * 3.1), Math.floor(z * 3.1)) - 0.5) * 0.08
    pos.setY(i, y + grain)
    const depth = waterDepth(x, z)
    const wet = depth > 0.12 ? Math.min(1, 0.48 + depth * 0.32) : depth > -0.75 ? clamp((depth + 0.75) / 0.75, 0, 0.42) : 0
    const [r, g, b] = biomeColor(x, z, Math.max(0, wet))
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.01,
    flatShading: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldN;\nvarying vec3 vWorldP;\n')
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvWorldN = normalize(mat3(modelMatrix) * objectNormal);\n',
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldN;\nvarying vec3 vWorldP;\n')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
          #include <color_fragment>
          float up = clamp(vWorldN.y, 0.0, 1.0);
          vec3 rock = vec3(0.42, 0.34, 0.26);
          float slope = 1.0 - smoothstep(0.42, 0.86, up);
          diffuseColor.rgb = mix(diffuseColor.rgb, rock * (0.55 + diffuseColor.r), slope * 0.72);
          float speckle = sin(vWorldP.x * 1.7) * sin(vWorldP.z * 1.35);
          float mottled = sin(vWorldP.x * 0.23 + vWorldP.z * 0.17);
          float grit = sin(vWorldP.x * 9.4 + vWorldP.z * 7.1) * sin(vWorldP.z * 8.2 - vWorldP.x * 3.4);
          diffuseColor.rgb *= 0.86 + 0.12 * speckle + 0.06 * mottled + 0.05 * grit;
          float grass = smoothstep(0.62, 0.92, up) * smoothstep(0.12, 0.42, diffuseColor.g);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 1.22, 0.7), grass * 0.48);
          float cavity = mix(0.72, 1.0, smoothstep(0.25, 0.88, up));
          float valley = 1.0 - smoothstep(0.4, 2.4, vWorldP.y);
          diffuseColor.rgb *= mix(1.0, 0.8, valley) * cavity;
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
          #include <emissivemap_fragment>
          float neon = smoothstep(0.55, 0.9, diffuseColor.g) * smoothstep(0.42, 0.08, diffuseColor.r);
          totalEmissiveRadiance += vec3(0.05, 0.95, 0.78) * neon;
          roughnessFactor = mix(0.96, 0.72, neon);
        `,
      )
  }
  const mesh = new THREE.Mesh(geo, material)
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.name = 'terrain'
  return mesh
}
