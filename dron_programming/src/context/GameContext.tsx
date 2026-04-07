import type { PropsWithChildren } from 'react'
import { useGameEngine } from '../hooks/useGameEngine'
import { GameContext } from './gameContextValue'

export function GameProvider({ children }: PropsWithChildren) {
  const game = useGameEngine()
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>
}
