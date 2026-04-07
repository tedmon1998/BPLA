import { Link, Outlet } from 'react-router-dom'
import { ru } from '../../shared/i18n/ru'
import { useActivation } from '../../shared/auth/ActivationContext'

function formatSessionTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AppLayout() {
  const { secondsLeft, endAttempt } = useActivation()

  return (
    <div className="layout">
      <header className="header">
        <div className="header-row">
          <Link to="/" className="brand">
            {ru.appTitle}
          </Link>
          <div className="session-bar">
            <span className="session-timer" title="Оставшееся время сессии">
              Сессия: {formatSessionTime(secondsLeft)}
            </span>
            <button type="button" className="session-end-btn" onClick={endAttempt}>
              Закончить попытку
            </button>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
