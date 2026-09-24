import './style.css'
import { Game, type Flags } from './game/Game.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#view')
const overlay = document.querySelector<HTMLElement>('#overlay')
const boot = document.querySelector('#boot-status')

if (!canvas || !overlay) {
  if (boot) boot.textContent = 'The seam failed to open. The page is missing its canvas.'
  throw new Error('Missing #view or #overlay')
}

const params = new URLSearchParams(location.search)
const quality = params.get('quality')
const at = params.get('at')
const stepParam = Number(params.get('step'))
const flags: Flags = {
  god: params.has('god'),
  noenemies: params.has('noenemies'),
  skip: params.has('skip'),
  bot: params.has('bot'),
  quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : null,
  at: at === 'lake' || at === 'camp' || at === 'needle' || at === 'fen' || at === 'glass' || at === 'verdant' ? at : null,
  step: stepParam === 0 || stepParam === 1 || stepParam === 2 || stepParam === 3 ? stepParam : null,
}

try {
  const game = new Game(canvas, overlay, flags)
  void game.init().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    if (boot) boot.textContent = `The seam failed to open. ${message}`
    console.error(err)
  })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  if (boot) boot.textContent = `The seam failed to open. ${message}`
  console.error(err)
}
