export type Quality = 'low' | 'medium' | 'high'

export interface Settings {
  quality: Quality
  sensitivity: number
  volume: number
  shake: boolean
}

const KEY = 'echofield-settings'

export const DEFAULT_SETTINGS: Settings = {
  quality: 'medium',
  sensitivity: 1,
  volume: 0.7,
  shake: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    const quality: Quality = parsed.quality === 'low' || parsed.quality === 'high' ? parsed.quality : 'medium'
    return {
      quality,
      sensitivity: clampNum(parsed.sensitivity, 0.35, 2.2, DEFAULT_SETTINGS.sensitivity),
      volume: clampNum(parsed.volume, 0, 1, DEFAULT_SETTINGS.volume),
      shake: parsed.shake !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private mode and blocked storage still leave the session playable.
  }
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
