import * as THREE from 'three'
import { addBox, mat, painted } from '../world/props.ts'

export interface Avatar {
  root: THREE.Group
  visual: THREE.Group
  weapon: THREE.Group
  swing: THREE.Mesh
  legL: THREE.Object3D
  legR: THREE.Object3D
  armR: THREE.Object3D
}

export function buildAvatar(): Avatar {
  const root = new THREE.Group()
  const visual = new THREE.Group()
  root.add(visual)

  const cloth = mat('#1e6a48', { roughness: 0.72 })
  const trim = mat('#d4893a', { roughness: 0.42, metalness: 0.28 })
  const dark = mat('#1a1612', { roughness: 0.8 })
  const skin = mat('#e4b898', { roughness: 0.7 })
  const scarf = mat('#f3e2c4', { roughness: 0.66 })

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  addBox(legL, 0.16, 0.58, 0.16, dark, 0, -0.24, 0)
  addBox(legR, 0.16, 0.58, 0.16, dark, 0, -0.24, 0)
  addBox(legL, 0.18, 0.1, 0.24, trim, 0, -0.48, 0.02)
  addBox(legR, 0.18, 0.1, 0.24, trim, 0, -0.48, 0.02)
  legL.position.set(-0.15, 0.82, 0)
  legR.position.set(0.15, 0.82, 0)
  visual.add(legL, legR)

  addBox(visual, 0.5, 0.66, 0.3, cloth, 0, 1.22, 0)
  addBox(visual, 0.78, 0.14, 0.3, trim, 0, 1.48, 0)
  addBox(visual, 0.58, 0.12, 0.34, trim, 0, 0.94, 0)
  const cape = painted(new THREE.BoxGeometry(0.62, 0.95, 0.08), mat('#143f32', { roughness: 0.8 }), 0, 1.2, 0.2)
  cape.rotation.x = 0.18
  visual.add(cape)
  const hood = painted(new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), mat('#16382c', { roughness: 0.75 }), 0, 1.72, 0.02)
  visual.add(hood)
  visual.add(painted(new THREE.SphereGeometry(0.18, 8, 6), skin, 0, 1.66, 0.06))
  addBox(visual, 0.34, 0.08, 0.1, scarf, 0, 1.5, 0.16)
  const tail = painted(new THREE.BoxGeometry(0.1, 0.42, 0.08), scarf, 0.16, 1.32, 0.16)
  tail.rotation.z = 0.4
  visual.add(tail)

  const armR = new THREE.Group()
  armR.position.set(0.38, 1.38, 0)
  addBox(armR, 0.13, 0.46, 0.13, cloth, 0, -0.2, 0)
  const weapon = new THREE.Group()
  weapon.position.set(0, -0.4, -0.05)
  const blade = addBox(weapon, 0.08, 0.12, 0.95, mat('#f2efe6', { metalness: 0.65, roughness: 0.28 }), 0, 0, -0.45)
  blade.castShadow = true
  addBox(weapon, 0.16, 0.08, 0.16, trim, 0, 0, 0.05)
  armR.add(weapon)
  visual.add(armR)

  const swingMat = mat('#fff4d2', {
    emissive: '#ffe7a8',
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.4,
  })
  const swing = painted(new THREE.BoxGeometry(0.2, 0.15, 1.15), swingMat, 0, 1.15, -0.95)
  swing.castShadow = false
  swing.visible = false
  visual.add(swing)

  return { root, visual, weapon, swing, legL, legR, armR }
}

export function animateAvatar(
  avatar: Avatar,
  time: number,
  speed: number,
  swimming: boolean,
  dodging: boolean,
  attack: { phase: string; kind: string | null; chain: number; t: number },
  downed: boolean,
): void {
  const amp = swimming ? 0.15 : Math.min(0.7, speed * 0.08)
  const swing = speed > 0.4 ? Math.sin(time * (speed > 7 ? 14 : 9)) : 0
  const idle = speed < 0.35 && !swimming && !dodging && attack.phase === 'idle' && !downed
  avatar.legL.rotation.x = swimming ? Math.sin(time * 6) * 0.4 : swing * amp
  avatar.legR.rotation.x = swimming ? Math.sin(time * 6 + 1) * 0.4 : -swing * amp
  avatar.visual.position.y = swimming ? Math.sin(time * 3) * 0.05 : idle ? Math.sin(time * 2.1) * 0.03 : Math.abs(swing) * 0.04 * amp
  const squash = attack.phase === 'active' ? (attack.kind === 'heavy' ? 0.78 : 0.88) : attack.phase === 'windup' ? 1.1 : 1
  avatar.visual.scale.y += (squash - avatar.visual.scale.y) * 0.4
  const widen = 1 + (1 - avatar.visual.scale.y) * 0.55
  avatar.visual.scale.x = widen
  avatar.visual.scale.z = widen

  let weaponX = -0.4
  if (attack.phase === 'windup') weaponX = attack.kind === 'heavy' ? -1.7 : -1.15
  if (attack.phase === 'active') weaponX = attack.kind === 'heavy' ? 1.35 : 1.05 + attack.chain * 0.1
  if (attack.phase === 'recover') weaponX = 0.2
  if (dodging) weaponX = -0.2
  avatar.weapon.rotation.x += (weaponX - avatar.weapon.rotation.x) * 0.45
  avatar.armR.rotation.z = attack.kind === 'heavy' && attack.phase !== 'idle' ? -0.4 : -0.15

  avatar.swing.visible = attack.phase === 'active'
  if (attack.phase === 'active') {
    avatar.swing.scale.set(attack.kind === 'heavy' ? 1.4 : 1, 1, attack.chain === 2 ? 1.25 : 1)
  }

  if (downed) {
    avatar.visual.rotation.x += (1.2 - avatar.visual.rotation.x) * 0.1
    avatar.visual.position.y = 0.4
  } else {
    avatar.visual.rotation.x *= 0.8
  }
}
