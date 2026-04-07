import { FIELD_WIDTH } from '../data/map'
import { useGameStore } from '../store/gameStore'

const hearts = (count: number) => '❤'.repeat(Math.max(0, count))

export function GameHUD() {
  const teams = useGameStore((s) => s.teams)
  const lives = useGameStore((s) => s.lives)
  const health = useGameStore((s) => s.health)
  const endAttempt = useGameStore((s) => s.endAttempt)

  return (
    <section className="hud" style={{ width: FIELD_WIDTH }}>
      <div className="hud-row">
        <div className="hud-card ai">
          <strong>ИИ: {teams.ai}</strong>
          <span>
            <span className="heart">❤</span> {lives.ai} · Здоровье {hearts(health.ai)} ({health.ai}/3)
          </span>
        </div>
        <div className="hud-card drone">
          <strong>Дрон: {teams.drone}</strong>
          <span>
            <span className="heart">❤</span> {lives.drone} · Здоровье {hearts(health.drone)} ({health.drone}/3)
          </span>
        </div>
      </div>

      <div className="hud-legend">
        <span className="legend-item">
          <span className="legend-icon double">2×</span>двойной выстрел
        </span>
        <span className="legend-item">
          <span className="legend-icon rico">↺</span>рикошет
        </span>
        <span className="legend-item">
          <span className="legend-icon mine">✚</span>мина
        </span>
        <span className="legend-item">
          <span className="legend-icon hp">❤+</span>лечение
        </span>
        <span className="legend-item">
          <span className="legend-icon pierce">⇄</span>прострел через стену
        </span>
        <span className="legend-item">
          <span className="legend-icon wall">▦</span>временная стена (1 попадание)
        </span>
        <button className="hud-btn" type="button" onClick={endAttempt}>
          Закончить попытку
        </button>
      </div>
    </section>
  )
}
