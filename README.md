# Echofield

A browser action slice set after the Sundering, when four ages were crushed into one continent. You play a seamwalker on foot: leave **Crosscamp**, clear **Thorn Camp** in the **Verdant Rift**, rest at a **Seamstone**, and reach the **Chrome Needle** in the **Neon Vein**. **Bone Fen** and the **Glass Expanse** are on the same continuous map if you wander.

The world, characters, and audio are procedural. No external models or sound files are required. If Web Audio cannot start, the game stays silent and keeps playing.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (the dev server uses port **43123**). Click **Begin walk** on the title screen. The title says **Echofield**.

Quality defaults to **Medium**. A phone with no saved setting starts on **Low**. Change it on the title screen or in the pause menu, or with `?quality=low|medium|high` for that visit.

- **Low** — no shadows, thinner grass, no bloom or FXAA. Meant for phones.
- **Medium** — soft shadows, milder bloom, FXAA.
- **High** — desktop look: dense grass, wider shadows, AgX tone mapping, vignette, and a little film grain. Bloom stays off the grass and on the bright seams (neon, the Needle, water glints).

Production build:

```bash
npm run build
npm run preview
```

`npm run smoke` checks terrain, swimming, and the objective order without a GPU.

## Deploy

Live: [https://echofield-five.vercel.app](https://echofield-five.vercel.app)

`vercel.json` builds with `npm run build` and publishes `dist`, with a fallback to `index.html`. The production project is **echofield** (Vite, output `dist`). Deployment protection is off.

To publish again from a machine that is logged into the same Vercel account:

```bash
npx vercel login
npx vercel link --project echofield --yes
npx vercel --prod --yes
```

## Controls

| Action | Key / mouse | Gamepad |
| --- | --- | --- |
| Move | WASD | Left stick |
| Look | Mouse (pointer lock), or arrow keys | Right stick |
| Sprint | Shift | RT |
| Jump | Space | A |
| Light chain | Left mouse | X |
| Heavy | Right mouse | Y |
| Dodge | Q | B |
| Parry | F | LB |
| Lock on | Tab or middle mouse (wheel cycles) | RB |
| Interact | E | LT |
| Map sketch | M | Back |
| Pause | Esc | Start |

Click the view if the mouse look does not capture. Arrow keys always turn the camera.

On a phone, a coarse pointer, or a narrow window, the left stick walks and a drag on the right side looks. Pointer lock stays off so the stick can move the player. Strike, dodge, jump, parry, and talk are the buttons on the right. WASD and the mouse stay the desktop controls on a wide window.

Swimming is on the rift lake (south of the west road), the canal under the east bridge, and the fen pool. Step off the bridge or walk down the lake spur. Sprint and jump still work; dodge and attacks do not while you are in deep water.

## What this slice includes

- Third-person move, sprint, jump, and swim on one heightmap
- Light 3-hit chain, heavy attack, dodge with a short invulnerable beat, parry, and lock-on
- Three enemies: Moss Stalkers, a Mire Brute, and Vein Drones that shoot slow bolts
- Crosscamp hub plus Verdant Rift and Neon Vein as the objective biomes, with Bone Fen and Glass Expanse on the same terrain
- Seamstone checkpoint (heals, sets respawn, saved in `localStorage`)
- Health, stamina, objective text, area name, compass, and a controls hint
- Quality **Low / Medium / High**, look sensitivity, volume, and camera shake, stored in `localStorage`
- Pause, a map sketch, and a short talk with Keeper Bram

## Debug flags

Add these to the URL:

- `?skip=1` starts immediately
- `?god=1` ignores damage and stamina
- `?noenemies=1` empties the field (walk into Thorn Camp to advance)
- `?quality=low`, `?quality=medium`, or `?quality=high`
- `?bot=1` walks the objective and fights (useful with `skip`)
- `?at=lake`, `?at=camp`, `?at=verdant`, `?at=needle`, `?at=fen`, or `?at=glass` moves a new walk's start
- `?step=2` starts a new walk at that objective step
- `F3` toggles a position readout

## Layout

```
src/
  main.ts
  game/          loop, objective flow
  core/          time, input, events, settings
  physics/       heightfield, colliders, character
  world/         biomes, terrain, water, props
  player/        avatar, camera, combat
  combat/        health, hitboxes
  enemies/
  ui/  audio/  fx/
  gameplay/      save, objectives
```
