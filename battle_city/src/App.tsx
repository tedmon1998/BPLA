import { useEffect, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { GameHUD } from './components/GameHUD'
import { GameOverModal } from './components/GameOverModal'
import { QuestionModal } from './components/QuestionModal'
import { ActivationScreen } from './components/ActivationScreen'
import { StartScreen } from './components/StartScreen'
import { useGameStore } from './store/gameStore'

function App() {
  const gameState = useGameStore((s) => s.gameState)
  const currentQuestion = useGameStore((s) => s.currentQuestion)
  const damagePauseTarget = useGameStore((s) => s.damagePauseTarget)
  const attemptEndsAtMs = useGameStore((s) => s.attemptEndsAtMs)
  const endAttempt = useGameStore((s) => s.endAttempt)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!attemptEndsAtMs) return
    if (nowMs >= attemptEndsAtMs) endAttempt()
  }, [attemptEndsAtMs, endAttempt, nowMs])

  const attemptActive = !!attemptEndsAtMs

  return (
    <main className="app">
      <h1 className="title">Битва: ИИ против дрона</h1>
      {!attemptActive ? (
        <ActivationScreen />
      ) : gameState === 'start' ? (
        <StartScreen />
      ) : (
        <>
          <GameHUD />
          <GameCanvas />
        </>
      )}

      {gameState === 'paused_question' && currentQuestion && <QuestionModal />}
      {gameState === 'paused_question' && !currentQuestion && damagePauseTarget && (
        <div className="pause-banner">{damagePauseTarget === 'ai' ? 'ИИ' : 'Дрон'} потерял 1 жизнь</div>
      )}
      {gameState === 'game_over' && <GameOverModal />}
    </main>
  )
}

export default App
