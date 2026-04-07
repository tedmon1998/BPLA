import { createContext } from 'react'
import type { GameEngineState } from '../hooks/useGameEngine'

export const GameContext = createContext<GameEngineState | null>(null)
