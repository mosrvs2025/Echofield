export type ObjectiveStep = 0 | 1 | 2 | 3

export interface Checkpoint {
  x: number
  y: number
  z: number
  label: string
}

export interface SaveData {
  v: 1
  objective: ObjectiveStep
  checkpoint: Checkpoint
  defeated: string[]
}

const KEY = 'echofield-save'

export function objectiveText(step: ObjectiveStep, campLeft: number): string {
  switch (step) {
    case 0:
      return `Leave Crosscamp. Clear Thorn Camp in the Verdant Rift (${campLeft} left).`
    case 1:
      return 'Rest at the Seamstone.'
    case 2:
      return 'Reach the Chrome Needle in the Neon Vein.'
    case 3:
      return 'The seam holds. Roam the field, or rest.'
  }
}

export function objectiveTarget(step: ObjectiveStep): { x: number; z: number } | null {
  switch (step) {
    case 0:
      return { x: -72, z: -2 }
    case 1:
      return { x: -54, z: 11 }
    case 2:
      return { x: 88, z: 2 }
    case 3:
      return null
  }
}

export interface Advance {
  step: ObjectiveStep
  advanced: boolean
  toast: string | null
}

export function onCampCleared(step: ObjectiveStep): Advance {
  if (step !== 0) return { step, advanced: false, toast: null }
  return { step: 1, advanced: true, toast: 'Thorn Camp is quiet. The Seamstone can take your rest.' }
}

export function onSeamstone(step: ObjectiveStep): Advance {
  if (step === 1) {
    return { step: 2, advanced: true, toast: 'The stone remembers you. East, the Chrome Needle is waking.' }
  }
  if (step === 0) {
    return { step, advanced: false, toast: 'You are marked. Thorn Camp is still standing.' }
  }
  return { step, advanced: false, toast: 'The seam remembers you.' }
}

export function onNeedle(step: ObjectiveStep): Advance {
  if (step === 2) {
    return { step: 3, advanced: true, toast: 'The Chrome Needle answers. The seam holds — for now.' }
  }
  if (step < 2) {
    return { step, advanced: false, toast: 'The Needle is dark. Quiet Thorn Camp and rest at the Seamstone first.' }
  }
  return { step, advanced: false, toast: null }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data.v !== 1 || !data.checkpoint || !Array.isArray(data.defeated)) return null
    const step = data.objective
    if (step !== 0 && step !== 1 && step !== 2 && step !== 3) return null
    return data
  } catch {
    return null
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Save is a comfort, not a gate.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
