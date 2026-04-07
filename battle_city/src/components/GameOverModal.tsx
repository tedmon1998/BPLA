import { useGameStore } from '../store/gameStore'

export function GameOverModal() {
  const winner = useGameStore((s) => s.winner)
  const teams = useGameStore((s) => s.teams)
  const resetToStart = useGameStore((s) => s.resetToStart)

  if (!winner) return null

  return (
    <div className="overlay">
      <section className="modal">
        <h2>Победил {winner === 'ai' ? 'ИИ' : 'дрон'}!</h2>
        <p>Команда: {winner === 'ai' ? teams.ai : teams.drone}</p>
        <button type="button" onClick={resetToStart}>
          Начать заново
        </button>
      </section>
    </div>
  )
}
