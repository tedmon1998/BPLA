import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { LogicNeuronPage } from './LogicNeuronPage'
import { ParityNumbersPage } from './ParityNumbersPage'
import { LettersAbcPage } from './LettersAbcPage'
import { LogicNetworkPage } from './LogicNetworkPage'
import { MedicalSinglePage } from './MedicalSinglePage'
import { MedicalMultiPage } from './MedicalMultiPage'

interface LevelDefinition {
  id: string
  title: string
  Component: ComponentType
}

const LEVELS: LevelDefinition[] = [
  { id: 'logic-neuron', title: 'Логический нейрон', Component: LogicNeuronPage },
  { id: 'parity', title: 'Четные / нечетные', Component: ParityNumbersPage },
  { id: 'letters-abc', title: 'Буквы A/B/C', Component: LettersAbcPage },
  { id: 'logic-network', title: 'Логическая нейросеть', Component: LogicNetworkPage },
  { id: 'medical-single', title: 'Диагноз: грипп', Component: MedicalSinglePage },
  { id: 'medical-multi', title: 'Несколько диагнозов', Component: MedicalMultiPage },
]

const REWARD_CODE = 'PR-X58R9'
const REWARD_TIMEOUT_SECONDS = 10

export function LevelFlowPage() {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0)
  const [isRewardOpen, setIsRewardOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(REWARD_TIMEOUT_SECONDS)
  const [levelPassed, setLevelPassed] = useState<Record<string, boolean>>({})

  const CurrentLevelComponent = LEVELS[currentLevelIndex].Component

  const progressPercent = useMemo(
    () => ((currentLevelIndex + 1) / LEVELS.length) * 100,
    [currentLevelIndex],
  )
  const currentLevelId = LEVELS[currentLevelIndex].id
  const canProceed = Boolean(levelPassed[currentLevelId])
  const setLevelProgress = useCallback((levelId: string, isComplete: boolean) => {
    setLevelPassed((prev) => {
      if (prev[levelId] === isComplete) {
        return prev
      }

      return { ...prev, [levelId]: isComplete }
    })
  }, [])
  const progressHandlers = useMemo(
    () => ({
      parity: (isComplete: boolean) => setLevelProgress('parity', isComplete),
      'logic-neuron': (isComplete: boolean) =>
        setLevelProgress('logic-neuron', isComplete),
      'letters-abc': (isComplete: boolean) => setLevelProgress('letters-abc', isComplete),
      'logic-network': (isComplete: boolean) =>
        setLevelProgress('logic-network', isComplete),
      'medical-single': (isComplete: boolean) =>
        setLevelProgress('medical-single', isComplete),
      'medical-multi': (isComplete: boolean) =>
        setLevelProgress('medical-multi', isComplete),
    }),
    [setLevelProgress],
  )

  const resetCourse = useCallback(() => {
    setIsRewardOpen(false)
    setCurrentLevelIndex(0)
    setSecondsLeft(REWARD_TIMEOUT_SECONDS)
    setLevelPassed({})
  }, [])

  const handleNext = () => {
    if (!canProceed) {
      return
    }

    if (currentLevelIndex >= LEVELS.length - 1) {
      setSecondsLeft(REWARD_TIMEOUT_SECONDS)
      setIsRewardOpen(true)
      return
    }

    setCurrentLevelIndex((prev) => prev + 1)
  }

  const handleBack = () => {
    setCurrentLevelIndex((prev) => Math.max(prev - 1, 0))
  }

  useEffect(() => {
    if (!isRewardOpen) {
      return
    }

    const startedAt = Date.now()
    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
      const remainingSeconds = Math.max(REWARD_TIMEOUT_SECONDS - elapsedSeconds, 0)
      setSecondsLeft(remainingSeconds)
    }, 200)

    const timeoutId = window.setTimeout(() => {
      resetCourse()
    }, REWARD_TIMEOUT_SECONDS * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [isRewardOpen, resetCourse])

  return (
    <section className="level-shell">
      <article className="panel level-progress">
        <div>
          <p className="hero-label">Режим уровней</p>
          <h2>
            Уровень {currentLevelIndex + 1} из {LEVELS.length}: {LEVELS[currentLevelIndex].title}
          </h2>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </article>

      {currentLevelId === 'parity' ? (
        <ParityNumbersPage onProgressChange={progressHandlers.parity} />
      ) : currentLevelId === 'logic-neuron' ? (
        <LogicNeuronPage onProgressChange={progressHandlers['logic-neuron']} />
      ) : currentLevelId === 'letters-abc' ? (
        <LettersAbcPage onProgressChange={progressHandlers['letters-abc']} />
      ) : currentLevelId === 'logic-network' ? (
        <LogicNetworkPage onProgressChange={progressHandlers['logic-network']} />
      ) : currentLevelId === 'medical-single' ? (
        <MedicalSinglePage onProgressChange={progressHandlers['medical-single']} />
      ) : currentLevelId === 'medical-multi' ? (
        <MedicalMultiPage onProgressChange={progressHandlers['medical-multi']} />
      ) : (
        <CurrentLevelComponent />
      )}

      <article className="panel level-actions">
        <button
          type="button"
          className="ghost"
          onClick={handleBack}
          disabled={currentLevelIndex === 0 || isRewardOpen}
        >
          Назад
        </button>
        <button type="button" onClick={handleNext} disabled={isRewardOpen || !canProceed}>
          {currentLevelIndex === LEVELS.length - 1
            ? 'Завершить курс'
            : 'Уровень пройден, далее'}
        </button>
      </article>
      {!canProceed ? (
        <p className="subtle">
          Для перехода дальше завершите текущий уровень успешно.
        </p>
      ) : null}

      {isRewardOpen ? (
        <div className="reward-overlay">
          <div className="reward-modal">
            <p className="hero-label">Награда</p>
            <h3>Вы прошли все уровни!</h3>
            <p>
              Ваш код награды: <strong>{REWARD_CODE}</strong>
            </p>
            <p>Возврат к началу через {secondsLeft} сек.</p>
            <button type="button" onClick={resetCourse}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
