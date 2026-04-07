import { create } from 'zustand'
import { AI_SPAWN, DRONE_SPAWN, generateRandomSymmetricMap } from '../data/map'
import { QUESTIONS } from '../data/questions'
import type { AimAngle, GameState, PlayerId, Question, TeamNames } from '../types/game'
import type { MapGrid } from '../data/map'

interface GameStore {
  gameState: GameState
  teams: TeamNames
  lives: { ai: number; drone: number }
  health: { ai: number; drone: number }
  attemptEndsAtMs: number | null
  winner: PlayerId | null
  currentQuestion: Question | null
  questionTarget: PlayerId | null
  lastQuestionId: string | null
  damagePauseTarget: PlayerId | null
  questionEndsAtMs: number | null
  questionRoundId: number
  roundResetToken: number
  map: MapGrid
  positions: { ai: { x: number; y: number }; drone: { x: number; y: number } }
  aimAngles: { ai: AimAngle; drone: AimAngle }
  activateAttempt: (endsAtMs: number) => void
  endAttempt: () => void
  startGame: (aiTeam: string, droneTeam: string) => void
  resetToStart: () => void
  setPosition: (player: PlayerId, x: number, y: number) => void
  setAimAngle: (player: PlayerId, angle: AimAngle) => void
  heal: (player: PlayerId, amount: number) => void
  takeHit: (player: PlayerId) => void
  triggerQuestion: (target: PlayerId) => void
  submitAnswer: (answerIndex: number) => void
}

const MAX_LIVES = 3
const MAX_HEALTH = 3
const DAMAGE_PAUSE_MS = 800
const ANSWER_TIME_MS = 7000

const pickQuestion = (lastQuestionId: string | null): Question => {
  const pool = QUESTIONS.filter((q) => q.id !== lastQuestionId)
  const source = pool.length > 0 ? pool : QUESTIONS
  return source[Math.floor(Math.random() * source.length)]
}

const shuffleQuestionOptions = (q: Question): Question => {
  // We shuffle options for display; correctAnswer index is updated accordingly.
  const options = [...q.options]
  const correctIdx = q.correctAnswer
  const items = options.map((opt, idx) => ({ opt, isCorrect: idx === correctIdx }))

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }

  const shuffledOptions = items.map((it) => it.opt) as [string, string, string]
  const newCorrectAnswer = items.findIndex((it) => it.isCorrect)

  return {
    ...q,
    options: shuffledOptions,
    correctAnswer: newCorrectAnswer,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'start',
  teams: { ai: '', drone: '' },
  lives: { ai: MAX_LIVES, drone: MAX_LIVES },
  health: { ai: MAX_HEALTH, drone: MAX_HEALTH },
  attemptEndsAtMs: null,
  winner: null,
  currentQuestion: null,
  questionTarget: null,
  lastQuestionId: null,
  damagePauseTarget: null,
  questionEndsAtMs: null,
  questionRoundId: 0,
  roundResetToken: 0,
  map: generateRandomSymmetricMap(),
  positions: { ai: { ...AI_SPAWN }, drone: { ...DRONE_SPAWN } },
  aimAngles: { ai: 0, drone: Math.PI },

  activateAttempt: (endsAtMs) =>
    set({
      attemptEndsAtMs: endsAtMs,
      gameState: 'start',
      teams: { ai: '', drone: '' },
      lives: { ai: MAX_LIVES, drone: MAX_LIVES },
      health: { ai: MAX_HEALTH, drone: MAX_HEALTH },
      winner: null,
      currentQuestion: null,
      questionTarget: null,
      damagePauseTarget: null,
      questionEndsAtMs: null,
      questionRoundId: 0,
      roundResetToken: 0,
      map: generateRandomSymmetricMap(),
      positions: { ai: { ...AI_SPAWN }, drone: { ...DRONE_SPAWN } },
      aimAngles: { ai: 0, drone: Math.PI },
    }),

  endAttempt: () =>
    set({
      attemptEndsAtMs: null,
      gameState: 'start',
      teams: { ai: '', drone: '' },
      lives: { ai: MAX_LIVES, drone: MAX_LIVES },
      health: { ai: MAX_HEALTH, drone: MAX_HEALTH },
      winner: null,
      currentQuestion: null,
      questionTarget: null,
      damagePauseTarget: null,
      questionEndsAtMs: null,
      questionRoundId: 0,
      roundResetToken: 0,
      map: generateRandomSymmetricMap(),
      positions: { ai: { ...AI_SPAWN }, drone: { ...DRONE_SPAWN } },
      aimAngles: { ai: 0, drone: Math.PI },
    }),

  startGame: (aiTeam, droneTeam) =>
    set({
      gameState: 'playing',
      teams: { ai: aiTeam.trim(), drone: droneTeam.trim() },
      lives: { ai: MAX_LIVES, drone: MAX_LIVES },
      health: { ai: MAX_HEALTH, drone: MAX_HEALTH },
      winner: null,
      currentQuestion: null,
      questionTarget: null,
      damagePauseTarget: null,
      questionEndsAtMs: null,
      roundResetToken: 1,
      map: generateRandomSymmetricMap(),
      positions: { ai: { ...AI_SPAWN }, drone: { ...DRONE_SPAWN } },
      aimAngles: { ai: 0, drone: Math.PI },
    }),

  resetToStart: () =>
    set({
      gameState: 'start',
      teams: { ai: '', drone: '' },
      lives: { ai: MAX_LIVES, drone: MAX_LIVES },
      health: { ai: MAX_HEALTH, drone: MAX_HEALTH },
      winner: null,
      currentQuestion: null,
      questionTarget: null,
      damagePauseTarget: null,
      questionEndsAtMs: null,
      roundResetToken: 0,
      map: generateRandomSymmetricMap(),
      positions: { ai: { ...AI_SPAWN }, drone: { ...DRONE_SPAWN } },
      aimAngles: { ai: 0, drone: Math.PI },
    }),

  setPosition: (player, x, y) =>
    set((state) => ({
      positions: {
        ...state.positions,
        [player]: { x, y },
      },
    })),

  setAimAngle: (player, angle) =>
    set((state) => ({
      aimAngles: {
        ...state.aimAngles,
        [player]: angle,
      },
    })),

  heal: (player, amount) =>
    set((state) => ({
      health: {
        ...state.health,
        [player]: Math.min(MAX_HEALTH, state.health[player] + amount),
      },
    })),

  takeHit: (player) => {
    const state = get()
    if (state.gameState !== 'playing') return

    const nextHealthValue = Math.max(0, state.health[player] - 1)
    set({
      health: {
        ...state.health,
        [player]: nextHealthValue,
      },
    })

    // Вопрос задаём только когда здоровье упало до 0 (3-е попадание).
    if (nextHealthValue <= 0) {
      get().triggerQuestion(player)
    }
  },

  triggerQuestion: (target) => {
    if (get().gameState !== 'playing') return
    const baseQuestion = pickQuestion(get().lastQuestionId)
    const nextQuestion = shuffleQuestionOptions(baseQuestion)
    const roundId = get().questionRoundId + 1
    const endsAt = Date.now() + ANSWER_TIME_MS
    set({
      gameState: 'paused_question',
      currentQuestion: nextQuestion,
      questionTarget: target,
      lastQuestionId: baseQuestion.id,
    })

    // Keep a reference to this specific question instance for timeout.
    set({ questionEndsAtMs: endsAt, questionRoundId: roundId })

    window.setTimeout(() => {
      const latest = get()
      if (latest.gameState !== 'paused_question') return
      if (latest.questionRoundId !== roundId) return
      // Timeout is treated as wrong answer.
      latest.submitAnswer(-1)
    }, ANSWER_TIME_MS)
  },

  submitAnswer: (answerIndex) => {
    const state = get()
    if (state.gameState !== 'paused_question' || !state.currentQuestion || !state.questionTarget) {
      return
    }

    const target = state.questionTarget
    const isCorrect = answerIndex === state.currentQuestion.correctAnswer
    if (isCorrect) {
      set({
        gameState: 'playing',
        currentQuestion: null,
        questionTarget: null,
        damagePauseTarget: null,
        questionEndsAtMs: null,
        roundResetToken: state.roundResetToken + 1,
        map: generateRandomSymmetricMap(),
        health: {
          ...state.health,
          [target]: MAX_HEALTH,
        },
      })
      return
    }

    // Неправильный ответ при HP=0 => теряем 1 жизнь и возрождаемся с полным здоровьем.
    const nextLives = {
      ...state.lives,
      [target]: Math.max(0, state.lives[target] - 1),
    }
    const finalHealth = {
      ...state.health,
      [target]: MAX_HEALTH,
    }

    if (nextLives[target] <= 0) {
      set({
        lives: nextLives,
        health: finalHealth,
        gameState: 'game_over',
        currentQuestion: null,
        questionTarget: null,
        damagePauseTarget: null,
        questionEndsAtMs: null,
        winner: target === 'ai' ? 'drone' : 'ai',
      })
      return
    }

    set({
      lives: nextLives,
      health: finalHealth,
      currentQuestion: null,
      questionTarget: null,
      damagePauseTarget: target,
      questionEndsAtMs: null,
      roundResetToken: state.roundResetToken + 1,
      map: generateRandomSymmetricMap(),
    })

    window.setTimeout(() => {
      const latest = get()
      if (latest.gameState === 'game_over') return
      set({
        gameState: 'playing',
        damagePauseTarget: null,
      })
    }, DAMAGE_PAUSE_MS)
  },
}))
