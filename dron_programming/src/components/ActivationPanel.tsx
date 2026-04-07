import { useMemo, useState } from 'react'
import { useGame } from '../context/useGame'
import styles from './ActivationPanel.module.css'

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function ActivationPanel() {
  const { isActivated, activationSecondsLeft, activateSession, endAttempt } = useGame()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const timeLeft = useMemo(
    () => formatTime(Math.max(0, activationSecondsLeft)),
    [activationSecondsLeft],
  )

  const handleActivate = () => {
    if (activateSession(input)) {
      setError('')
      setInput('')
      return
    }
    setError('Неверный код активации.')
  }

  return (
    <section className={styles.wrapper}>
      <h3>Активация</h3>
      {!isActivated ? (
        <>
          <p className={styles.text}>Введите код активации перед началом попытки.</p>
          <div className={styles.row}>
            <input
              className={styles.input}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Код активации"
            />
            <button type="button" onClick={handleActivate}>
              Активировать
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </>
      ) : (
        <>
          <p className={styles.text}>Сессия активна. Осталось времени: {timeLeft}</p>
          <button type="button" onClick={endAttempt} className={styles.endButton}>
            Закончить попытку
          </button>
        </>
      )}
    </section>
  )
}
