import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import {
  areaDiffPercent,
  buildUserCurve,
  type HyperParams,
  type LossPoint,
} from './lib/simulator'

type PublicQuestion = {
  id: string
  question: string
  options: string[]
}

type ChallengePayload = {
  initialParams: HyperParams
  targetCurve: LossPoint[]
}

function App() {
  const [params, setParams] = useState<HyperParams | null>(null)
  const [targetCurve, setTargetCurve] = useState<LossPoint[]>([])
  const [error, setError] = useState('')
  const [isTraining, setIsTraining] = useState(false)
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<PublicQuestion[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [quizTimeLeft, setQuizTimeLeft] = useState(15)
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null)
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false)
  const [successKey, setSuccessKey] = useState<string | null>(null)
  const [successTimeLeft, setSuccessTimeLeft] = useState(10)
  const [activationCode, setActivationCode] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [isActivated, setIsActivated] = useState(false)
  const [activationTimeLeft, setActivationTimeLeft] = useState(20 * 60)

  const applyChallenge = useCallback((payload: ChallengePayload) => {
    setParams(payload.initialParams)
    setTargetCurve(payload.targetCurve)
    setQuizQuestions([])
    setQuizAnswers({})
    setQuizTimeLeft(15)
    setQuizStartedAt(null)
    setSuccessKey(null)
    setSuccessTimeLeft(10)
    setIsLoadingChallenge(false)
    setError('')
  }, [])

  const loadChallenge = useCallback(async () => {
    setIsLoadingChallenge(true)
    try {
      const response = await fetch('/api/challenge', { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error('Challenge request failed')
      }
      const payload = (await response.json()) as ChallengePayload
      applyChallenge(payload)
    } catch {
      setError('Не удалось загрузить задание. Обновите страницу.')
    } finally {
      setIsLoadingChallenge(false)
    }
  }, [applyChallenge])

  const evaluation = useMemo(() => {
    if (!params || targetCurve.length === 0) {
      return { curve: [] as LossPoint[], diffPercent: Number.POSITIVE_INFINITY, unlocked: false }
    }
    const curve = buildUserCurve(params, targetCurve)
    const diffPercent = areaDiffPercent(curve)
    return { curve, diffPercent, unlocked: diffPercent < 1 }
  }, [params, targetCurve])

  const canTrain =
    !!params &&
    targetCurve.length > 0 &&
    evaluation.unlocked &&
    !isTraining &&
    quizQuestions.length === 0 &&
    !successKey

  const activate = async () => {
    setIsActivating(true)
    setError('')
    try {
      const response = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: activationCode.trim() }),
      })
      if (!response.ok) {
        throw new Error('Activation failed')
      }
      const payload: {
        challenge: ChallengePayload
        activatedUntil: number
      } = await response.json()
      applyChallenge(payload.challenge)
      setIsActivated(true)
      setActivationCode('')
      setActivationTimeLeft(
        Math.max(0, Math.floor((payload.activatedUntil - Date.now()) / 1000)),
      )
    } catch {
      setError('Неверный код активации.')
      setIsActivated(false)
    } finally {
      setIsActivating(false)
    }
  }

  const finishAttempt = useCallback(async () => {
    try {
      await fetch('/api/deactivate', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } finally {
      setIsActivated(false)
      setIsLoadingChallenge(false)
      setActivationTimeLeft(20 * 60)
      setSuccessKey(null)
      setQuizQuestions([])
      setQuizAnswers({})
      setError('')
    }
  }, [])

  const updateParam = <K extends keyof HyperParams>(name: K, value: HyperParams[K]) => {
    if (!params) {
      return
    }
    setParams((prev) => (prev ? { ...prev, [name]: value } : prev))
    setSuccessKey(null)
    setError('')
  }

  const onTrain = async () => {
    if (!evaluation.unlocked) {
      return
    }

    setIsTraining(true)
    setError('')

    try {
      const response = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(params ?? {}),
      })

      if (!response.ok) {
        const payload: { message?: string } = await response.json()
        throw new Error(payload.message ?? 'Server rejected training attempt')
      }

      const payload: { quiz?: PublicQuestion[]; expiresInMs?: number } = await response.json()
      if (!payload.quiz || payload.quiz.length !== 2) {
        throw new Error('Quiz is missing in response')
      }

      setQuizQuestions(payload.quiz)
      setQuizAnswers({})
      setQuizStartedAt(Date.now())
      setQuizTimeLeft(Math.max(1, Math.ceil((payload.expiresInMs ?? 15000) / 1000)))
    } catch {
      setError('Не удалось запустить квиз. Подберите параметры и попробуйте снова.')
    } finally {
      setIsTraining(false)
    }
  }

  useEffect(() => {
    if (quizQuestions.length === 0 || !quizStartedAt) {
      return
    }

    const intervalId = window.setInterval(() => {
      const left = Math.max(0, 15 - Math.floor((Date.now() - quizStartedAt) / 1000))
      setQuizTimeLeft(left)
    }, 200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [quizQuestions, quizStartedAt])

  const closeSuccessAndRestart = useCallback(async () => {
    setSuccessKey(null)
    setSuccessTimeLeft(10)
    await loadChallenge()
  }, [loadChallenge])

  const submitQuiz = useCallback(async () => {
    if (quizQuestions.length === 0) {
      return
    }
    setIsSubmittingQuiz(true)
    setError('')
    try {
      const response = await fetch('/api/quiz-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ answers: quizAnswers }),
      })

      const payload: {
        ok?: boolean
        key?: string
        challenge?: ChallengePayload
      } = await response.json()

      if (response.ok && payload.ok && payload.key) {
        setQuizQuestions([])
        setQuizAnswers({})
        setQuizStartedAt(null)
        setQuizTimeLeft(15)
        setSuccessKey(payload.key)
        setSuccessTimeLeft(10)
        return
      }

      if (payload.challenge) {
        applyChallenge(payload.challenge)
      }
      setError('Квиз не пройден. Задание сгенерировано заново с новыми параметрами.')
    } catch {
      setError('Ошибка при проверке квиза. Попробуйте снова.')
    } finally {
      setIsSubmittingQuiz(false)
    }
  }, [applyChallenge, quizAnswers, quizQuestions])

  useEffect(() => {
    if (quizQuestions.length > 0 && quizTimeLeft === 0 && !isSubmittingQuiz) {
      void submitQuiz()
    }
  }, [quizQuestions, quizTimeLeft, isSubmittingQuiz, submitQuiz])

  useEffect(() => {
    if (!isActivated) {
      return
    }
    const timerId = window.setInterval(() => {
      setActivationTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => {
      window.clearInterval(timerId)
    }
  }, [isActivated])

  useEffect(() => {
    if (isActivated && activationTimeLeft === 0) {
      void finishAttempt()
    }
  }, [activationTimeLeft, finishAttempt, isActivated])

  useEffect(() => {
    if (!successKey) {
      return
    }

    const timerId = window.setInterval(() => {
      setSuccessTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [successKey])

  useEffect(() => {
    if (successKey && successTimeLeft === 0) {
      void closeSuccessAndRestart()
    }
  }, [closeSuccessAndRestart, successKey, successTimeLeft])

  if (!isActivated) {
    return (
      <main className="simulator">
        <h1>Симулятор потерь ML</h1>
        <p className="description">Введите код активации, чтобы начать попытку.</p>
        <section className="controls">
          <label>
            Код активации
            <input
              type="password"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="Введите код"
            />
          </label>
        </section>
        <button
          type="button"
          className="train-btn"
          onClick={() => void activate()}
          disabled={isActivating || activationCode.trim().length === 0}
        >
          {isActivating ? 'Проверка...' : 'Активировать'}
        </button>
        {error ? <div className="error-box">{error}</div> : null}
      </main>
    )
  }

  if (isLoadingChallenge || !params) {
    return (
      <main className="simulator">
        <h1>Симулятор потерь ML</h1>
        <p className="description">Загрузка задания...</p>
      </main>
    )
  }

  return (
    <main className="simulator">
      <h1>Симулятор потерь ML</h1>
      <p className="description">
        Этап 1: подберите параметры до разницы меньше 1%. Этап 2: за 15 секунд ответьте на 2
        вопроса. Ошибка в квизе или таймаут сбрасывает задание на новый случайный профиль.
      </p>

      <p className="status">
        Время попытки: <strong>{Math.floor(activationTimeLeft / 60)}:</strong>
        <strong>{String(activationTimeLeft % 60).padStart(2, '0')}</strong>
      </p>

      <section className="controls">
        <label>
          Learning Rate: <strong>{params.learningRate.toFixed(4)}</strong>
          <input
            type="range"
            min={0.001}
            max={0.1}
            step={0.001}
            value={params.learningRate}
            onChange={(e) => updateParam('learningRate', Number(e.target.value))}
          />
        </label>

        <label>
          Epochs: <strong>{params.epochs}</strong>
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={params.epochs}
            onChange={(e) => updateParam('epochs', Number(e.target.value))}
          />
        </label>

        <label>
          Batch Size: <strong>{params.batchSize}</strong>
          <input
            type="range"
            min={8}
            max={128}
            step={8}
            value={params.batchSize}
            onChange={(e) => updateParam('batchSize', Number(e.target.value))}
          />
        </label>
      </section>

      <section className="chart-card">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={evaluation.curve}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="epoch" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="targetLoss"
              name="Target Loss"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="userLoss"
              name="Your Loss"
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <p className="status">
        Разница площадей: <strong>{evaluation.diffPercent.toFixed(2)}%</strong>
      </p>

      <button type="button" className="train-btn" disabled={!canTrain} onClick={onTrain}>
        {isTraining ? 'Проверка...' : 'Обучить и открыть квиз'}
      </button>
      <button
        type="button"
        className="train-btn finish-btn"
        onClick={() => void finishAttempt()}
      >
        Закончить попытку
      </button>

      {error ? <div className="error-box">{error}</div> : null}

      {quizQuestions.length > 0 ? (
        <div className="quiz-overlay" role="dialog" aria-modal="true">
          <div className="quiz-modal">
            <h2>Финальный квиз</h2>
            <p className="quiz-timer">Осталось: {quizTimeLeft} сек</p>

            {quizQuestions.map((question, idx) => (
              <fieldset key={question.id} className="quiz-question">
                <legend>
                  {idx + 1}. {question.question}
                </legend>
                {question.options.map((option) => (
                  <label key={option} className="quiz-option">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={quizAnswers[question.id] === option}
                      onChange={(e) =>
                        setQuizAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ))}

            <button
              type="button"
              className="train-btn"
              disabled={isSubmittingQuiz}
              onClick={() => void submitQuiz()}
            >
              {isSubmittingQuiz ? 'Проверка ответов...' : 'Отправить ответы'}
            </button>
          </div>
        </div>
      ) : null}

      {successKey ? (
        <div className="quiz-overlay" role="dialog" aria-modal="true">
          <div className="quiz-modal success-modal">
            <h2>Ответ принят</h2>
            <p className="status">
              Ключ: <strong>{successKey}</strong>
            </p>
            <p className="quiz-timer">Окно закроется через: {successTimeLeft} сек</p>
            <button type="button" className="train-btn" onClick={() => void closeSuccessAndRestart()}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
