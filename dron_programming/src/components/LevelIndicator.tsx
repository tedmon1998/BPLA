import { useGame } from '../context/useGame'
import styles from './LevelIndicator.module.css'

export function LevelIndicator() {
  const { currentLevel, currentLevelIndex, levels, progress } = useGame()

  return (
    <div className={styles.wrapper}>
      <div>
        <h2 className={styles.title}>
          Уровень {currentLevel.id}: {currentLevel.title}
        </h2>
        <p className={styles.description}>{currentLevel.description}</p>
      </div>
      <div className={styles.badges}>
        <span>Прогресс: {progress}/{levels.length}</span>
        <span>Текущий индекс: {currentLevelIndex + 1}</span>
      </div>
    </div>
  )
}
