import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { Quality } from '../core/settings.ts'

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uContrast: { value: 1 },
    uSat: { value: 1.12 },
    uVignette: { value: 0.22 },
    uGrain: { value: 0.025 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uLift;
    uniform vec3 uGain;
    uniform float uContrast;
    uniform float uSat;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      c = max(c, 0.0) * uGain + uLift;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 split = mix(vec3(0.94, 0.97, 1.04), vec3(1.05, 1.015, 0.95), smoothstep(0.16, 0.74, luma));
      c *= split;
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.95, 0.28, length(d * vec2(1.15, 1.0)));
      c *= mix(1.0 - uVignette * 0.85, 1.0, vig);
      float n = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime * 13.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }
  `,
}

export class Post {
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly grade: ShaderPass
  private readonly fxaa: FXAAPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, quality: Quality) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.18, 0.42, 0.78)
    this.composer.addPass(this.bloom)
    this.grade = new ShaderPass(gradeShader)
    this.composer.addPass(this.grade)
    this.composer.addPass(new OutputPass())
    this.fxaa = new FXAAPass()
    this.composer.addPass(this.fxaa)
    this.applyQuality(quality)
  }

  applyQuality(quality: Quality): void {
    const high = quality === 'high'
    const low = quality === 'low'
    this.bloom.enabled = !low
    this.bloom.strength = high ? 0.22 : 0.1
    this.bloom.radius = high ? 0.46 : 0.32
    this.bloom.threshold = high ? 0.72 : 0.82
    this.fxaa.enabled = !low
    const uniforms = this.grade.uniforms
    uniforms.uSat!.value = high ? 1.22 : low ? 1.08 : 1.16
    uniforms.uVignette!.value = high ? 0.34 : low ? 0.16 : 0.26
    uniforms.uGrain!.value = low ? 0 : high ? 0.035 : 0.02
  }

  setGrade(lift: THREE.Vector3, gain: THREE.Vector3, contrast: number): void {
    const uniforms = this.grade.uniforms
    ;(uniforms.uLift!.value as THREE.Vector3).copy(lift)
    ;(uniforms.uGain!.value as THREE.Vector3).copy(gain)
    uniforms.uContrast!.value = contrast
  }

  setTime(time: number): void {
    this.grade.uniforms.uTime!.value = time
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    const bloomScale = this.bloom.strength > 0.15 ? 0.6 : 0.4
    this.bloom.resolution.set(Math.max(1, width * bloomScale), Math.max(1, height * bloomScale))
    this.bloom.needsUpdate = true
  }

  render(): void {
    this.composer.render()
  }
}
