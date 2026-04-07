import { useContext } from 'react'
import type { GameEngineState } from '../hooks/useGameEngine'
import { GameContext } from './gameContextValue'

export function useGame(): GameEngineState {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used inside GameProvider')
  }
  return context
}
