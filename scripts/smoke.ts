import { stickAxes } from '../src/core/input.ts'
import { createBody, stepCharacter } from '../src/physics/character.ts'
import { aabb, resolveCircle } from '../src/physics/colliders.ts'
import { terrainHeight, waterDepth, waterSurface } from '../src/physics/heightfield.ts'
import { onCampCleared, onNeedle, onSeamstone } from '../src/gameplay/session.ts'
import { biomeAt } from '../src/world/biomes.ts'
import { LAYOUT } from '../src/world/layout.ts'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

for (let x = -110; x <= 110; x += 10) {
  for (let z = -110; z <= 110; z += 10) {
    const h = terrainHeight(x, z)
    assert(Number.isFinite(h), `non-finite height at ${x},${z}`)
  }
}

const hub = terrainHeight(0, 0)
const camp = terrainHeight(LAYOUT.camp.x, LAYOUT.camp.z)
const lakeDepth = waterDepth(LAYOUT.lake.x, LAYOUT.lake.z)
const canalDepth = waterDepth(LAYOUT.canal.x, LAYOUT.canal.z)
assert(hub > 2.6 && hub < 3.8, `hub height ${hub}`)
assert(camp > 3.6 && camp < 4.9, `camp height ${camp}`)
assert(lakeDepth > 1, `lake depth ${lakeDepth}`)
assert(canalDepth > 1, `canal depth ${canalDepth}`)
assert(waterSurface(LAYOUT.needle.x, LAYOUT.needle.z) === null, 'needle should be dry')
assert(waterDepth(LAYOUT.camp.x, LAYOUT.camp.z) < 0.2, 'camp should be dry')
assert(biomeAt(-80, 0).dominant === 'verdant', `west ${biomeAt(-80, 0).dominant}`)
assert(biomeAt(100, 2).dominant === 'neon', `east ${biomeAt(100, 2).dominant}`)
assert(biomeAt(0, 0).dominant === 'hub', `hub biome ${biomeAt(0, 0).dominant}`)
assert(biomeAt(0, -80).dominant === 'fen', `north ${biomeAt(0, -80).dominant}`)
assert(biomeAt(0, 80).dominant === 'glass', `south ${biomeAt(0, 80).dominant}`)

const probe = {
  ground: (x: number, z: number) => terrainHeight(x, z),
  waterSurface,
  blocks: [],
  limit: LAYOUT.limit,
}

const walker = createBody(0, 11, terrainHeight(0, 11))
for (let i = 0; i < 90; i++) stepCharacter(walker, { wishX: -1, wishZ: 0, speed: 6, jump: false }, probe, 1 / 60)
assert(walker.x < -3, `walker should move west, x=${walker.x}`)
assert(!walker.swimming, 'trail walk should stay dry')
assert(Math.abs(walker.y - terrainHeight(walker.x, walker.z)) < 0.35, 'walker should stay on the ground')

const jumper = createBody(0, 0, terrainHeight(0, 0))
stepCharacter(jumper, { wishX: 0, wishZ: 0, speed: 0, jump: true }, probe, 1 / 60)
assert(jumper.vy > 5, `jump velocity ${jumper.vy}`)

const swimmer = createBody(LAYOUT.lake.x, LAYOUT.lake.z, 12)
for (let i = 0; i < 240; i++) stepCharacter(swimmer, { wishX: 0, wishZ: 0, speed: 0, jump: false }, probe, 1 / 60)
assert(swimmer.swimming, `lake should be swimmable (y=${swimmer.y.toFixed(2)})`)

const wall = aabb(0, 1, 0, 1, 1, 1)
const blocked = resolveCircle(-1.2, 0, 0.42, 0, 1.7, 0.5, [wall])
assert(blocked.x <= -1.4, `circle should be pushed out, x=${blocked.x}`)

const step = aabb(0, 0.15, 0, 1, 0.15, 1)
const stepped = resolveCircle(0, 0, 0.42, 0, 1.7, 0.58, [step])
assert(Math.abs(stepped.x) < 0.05, 'low props should be step-ups')

assert(onCampCleared(0).step === 1 && onCampCleared(0).advanced, 'camp clear')
assert(onSeamstone(0).advanced === false, 'early rest does not skip the camp')
assert(onSeamstone(1).step === 2, 'seamstone advances')
assert(onNeedle(0).advanced === false, 'early needle')
assert(onNeedle(2).step === 3, 'needle completes')

const still = stickAxes(0, 0, 50)
assert(still.ax === 0 && still.ay === 0, 'stick center is dead')
const north = stickAxes(0, -50, 50)
assert(north.ay > 0.9 && Math.abs(north.ax) < 0.01, `stick up should walk forward ay=${north.ay}`)
const east = stickAxes(50, 0, 50)
assert(east.ax > 0.9 && Math.abs(east.ay) < 0.01, `stick right ax=${east.ax}`)
const nudge = stickAxes(4, -4, 50)
assert(nudge.ax === 0 && nudge.ay === 0, 'stick deadzone holds still')

console.log('smoke ok', { hub: hub.toFixed(2), camp: camp.toFixed(2), lakeDepth: lakeDepth.toFixed(2), canalDepth: canalDepth.toFixed(2) })
