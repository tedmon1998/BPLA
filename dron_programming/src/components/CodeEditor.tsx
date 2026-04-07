import { useGame } from '../context/useGame'
import styles from './CodeEditor.module.css'

const PLACEHOLDER = `forward 5
up 3
forward 5
down 3`

export function CodeEditor() {
  const { code, setCode, isExecuting, runCode, resetCurrentLevel, isActivated } = useGame()

  return (
    <section className={styles.wrapper}>
      <h3>Панель кода</h3>
      <textarea
        className={styles.editor}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder={PLACEHOLDER}
        disabled={isExecuting}
      />
      <div className={styles.controls}>
        <button type="button" onClick={() => void runCode()} disabled={isExecuting || !isActivated}>
          {isExecuting ? 'Выполнение...' : 'Запустить'}
        </button>
        <button type="button" onClick={resetCurrentLevel} disabled={isExecuting}>
          Сброс
        </button>
      </div>
      <p className={styles.hint}>
        Команды: <code>forward X</code>, <code>up X</code>, <code>down X</code>, <code>left X</code>, <code>right X</code>, <code>hover</code>.
      </p>
    </section>
  )
}
