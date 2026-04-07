import { GameProvider } from './context/GameContext'
import { useGame } from './context/useGame'
import { CodeEditor } from './components/CodeEditor'
import { ActivationPanel } from './components/ActivationPanel'
import { Console } from './components/Console'
import { GameCanvas } from './components/GameCanvas'
import { LevelIndicator } from './components/LevelIndicator'
import { RewardModal } from './components/RewardModal'
import styles from './App.module.css'

function GameLayout() {
  const { logs } = useGame()

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Drone Code Quest</h1>
      </header>
      <main className={styles.main}>
        <section className={styles.canvasSection}>
          <LevelIndicator />
          <GameCanvas />
        </section>
        <aside className={styles.sidebar}>
          <ActivationPanel />
          <CodeEditor />
          <Console logs={logs} />
        </aside>
      </main>
      <RewardModal />
    </div>
  )
}

function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  )
}

export default App
