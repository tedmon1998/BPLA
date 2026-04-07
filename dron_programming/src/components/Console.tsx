import styles from './Console.module.css'

interface ConsoleProps {
  logs: string[]
}

export function Console({ logs }: ConsoleProps) {
  return (
    <section className={styles.wrapper}>
      <h3>Console Output</h3>
      <div className={styles.logBox}>
        {logs.map((line, index) => (
          <div className={styles.logLine} key={`${index}-${line}`}>
            {line}
          </div>
        ))}
      </div>
    </section>
  )
}
