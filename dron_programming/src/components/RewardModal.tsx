import { useEffect, useState } from 'react'
import { SECRET_CODE } from '../data/levels'
import { useGame } from '../context/useGame'
import styles from './RewardModal.module.css'

function RewardContent({ onClose }: { onClose: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(10)

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Поздравляем!</h2>
        <p>Ваш секретный код: {SECRET_CODE}</p>
        <small>Окно закроется автоматически через: {secondsLeft} сек.</small>
        <button className={styles.closeButton} onClick={onClose} type="button">
          Закрыть
        </button>
      </div>
    </div>
  )
}

export function RewardModal() {
  const { isRewardOpen, closeRewardAndRestart } = useGame()

  if (!isRewardOpen) {
    return null
  }

  return <RewardContent onClose={closeRewardAndRestart} />
}
