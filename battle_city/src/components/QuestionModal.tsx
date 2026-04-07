import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function QuestionModal() {
  const question = useGameStore((s) => s.currentQuestion)
  const questionTarget = useGameStore((s) => s.questionTarget)
  const submitAnswer = useGameStore((s) => s.submitAnswer)
  const questionEndsAtMs = useGameStore((s) => s.questionEndsAtMs)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 100)
    return () => window.clearInterval(t)
  }, [])

  const remainingMs = useMemo(() => {
    if (!questionEndsAtMs) return ANSWER_TIME_FALLBACK_MS
    return Math.max(0, questionEndsAtMs - nowMs)
  }, [nowMs, questionEndsAtMs])

  const remainingSec = Math.ceil(remainingMs / 1000)

  if (!question || !questionTarget) return null

  return (
    <div className="overlay">
      <section className="modal">
        <div className="question-timer">Время: {remainingSec} сек</div>
        <h3>{questionTarget === 'ai' ? 'ИИ' : 'Дрон'} выбит! Ответьте на вопрос</h3>
        <p>{question.question}</p>
        <div className="stack">
          {question.options.map((option, idx) => (
            <button key={option} type="button" onClick={() => submitAnswer(idx)}>
              {idx + 1}. {option}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

const ANSWER_TIME_FALLBACK_MS = 7000
