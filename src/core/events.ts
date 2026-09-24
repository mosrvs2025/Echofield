type Listener<T> = (payload: T) => void

export interface GameEvents {
  toast: { text: string }
  hurt: { who: 'player' | 'enemy'; heavy: boolean }
  defeat: { id: string; archetype: string }
  rest: { advanced: boolean }
  objective: { step: number; text: string }
  parry: Record<string, never>
  swing: { heavy: boolean }
  splash: Record<string, never>
}

export class Emitter<Events extends object> {
  private map = new Map<keyof Events, Set<Listener<never>>>()

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    let set = this.map.get(type)
    if (!set) {
      set = new Set()
      this.map.set(type, set)
    }
    set.add(fn as Listener<never>)
    return () => set.delete(fn as Listener<never>)
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.map.get(type)
    if (!set) return
    for (const fn of set) (fn as (p: Events[K]) => void)(payload)
  }
}
