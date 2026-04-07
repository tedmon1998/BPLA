import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGameStore } from '../store/gameStore'

const MAX_TEAM_NAME = 20

export function StartScreen() {
  const startGame = useGameStore((s) => s.startGame)
  const [aiTeam, setAiTeam] = useState('')
  const [droneTeam, setDroneTeam] = useState('')

  const validAi = aiTeam.trim().length > 0
  const validDrone = droneTeam.trim().length > 0
  const canStart = validAi && validDrone

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canStart) return
    startGame(aiTeam, droneTeam)
  }

  return (
    <section className="panel">
      <h2>Старт матча</h2>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Название команды ИИ
          <input
            value={aiTeam}
            maxLength={MAX_TEAM_NAME}
            onChange={(e) => setAiTeam(e.target.value)}
            placeholder="Например, НейроШторм"
          />
        </label>
        <label>
          Название команды дрона
          <input
            value={droneTeam}
            maxLength={MAX_TEAM_NAME}
            onChange={(e) => setDroneTeam(e.target.value)}
            placeholder="Например, Небесный отряд"
          />
        </label>
        <button type="submit" disabled={!canStart}>
          Начать игру
        </button>
      </form>
    </section>
  )
}
