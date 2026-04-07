export interface SeededRandom {
  next: () => number
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0

  return {
    next: () => {
      state = (1664525 * state + 1013904223) >>> 0
      return state / 4294967296
    },
  }
}
