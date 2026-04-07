export type PlayerId = 'ai' | 'drone'
export type GameState = 'start' | 'playing' | 'paused_question' | 'game_over'

export interface TeamNames {
  ai: string
  drone: string
}

export interface Question {
  id: string
  question: string
  options: [string, string, string]
  correctAnswer: number
}

// Aim angle in radians. 0 = right, PI/2 = down.
export type AimAngle = number
