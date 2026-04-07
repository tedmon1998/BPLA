import { useEffect, useMemo, useState } from 'react'
import './App.css'

type DetectionItem = {
  id: string
  objectType: 'car' | 'person' | 'tree'
  isIncorrect: boolean
  box: { x: number; y: number; w: number; h: number }
}

type Scenario = {
  id: string
  palette: { bg: string; road: string }
  items: DetectionItem[]
  incorrectId: string
}

type Quiz = {
  id: string
  title: string
  prompt: string
  pairs: { id: string; year: string; model: string }[]
  options: string[]
}

const keyCodePoints = [65, 73, 45, 69, 82, 82, 45, 48, 55]
const activationCode = '1083858'
const attemptDurationSec = 20 * 60
const roundDurationSec = 75
const revealDurationSec = 10
const quizDurationSec = 15
const objectTypes: DetectionItem['objectType'][] = ['car', 'person', 'tree']

const encodeSvg = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

const objectShape = (item: DetectionItem) => {
  if (item.objectType === 'car') {
    return '<rect x="16" y="58" width="56" height="16" rx="3" fill="#7c3aed"/><rect x="26" y="50" width="28" height="10" rx="2" fill="#8b5cf6"/>'
  }
  if (item.objectType === 'person') {
    return '<circle cx="40" cy="30" r="7" fill="#0284c7"/><rect x="34" y="38" width="12" height="28" rx="4" fill="#0369a1"/>'
  }
  return '<rect x="34" y="22" width="8" height="48" fill="#6b4f2b"/><circle cx="38" cy="20" r="16" fill="#22c55e"/>'
}

const imageForItem = (item: DetectionItem, palette: Scenario['palette']) => {
  const laneColor = item.objectType === 'tree' ? palette.road : '#94a3b8'

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect x="0" y="0" width="96" height="96" fill="${palette.bg}" />
  <rect x="0" y="70" width="96" height="26" fill="${laneColor}" opacity="0.5" />
  ${objectShape(item)}
  <rect x="${item.box.x}" y="${item.box.y}" width="${item.box.w}" height="${item.box.h}" fill="none" stroke="#ef4444" stroke-width="2.5" />
</svg>`
  return encodeSvg(svg)
}

const baseBoxByType: Record<DetectionItem['objectType'], DetectionItem['box']> = {
  car: { x: 16, y: 50, w: 56, h: 24 },
  person: { x: 33, y: 23, w: 14, h: 43 },
  tree: { x: 22, y: 4, w: 32, h: 66 },
}

const scenarioSeeds = [
  { id: 'urban-dawn', palette: { bg: '#dbeafe', road: '#94a3b8' }, incorrectIndex: 6, xShift: 0 },
  { id: 'forest-edge', palette: { bg: '#dcfce7', road: '#86efac' }, incorrectIndex: 13, xShift: 2 },
  { id: 'industrial', palette: { bg: '#fee2e2', road: '#fca5a5' }, incorrectIndex: 20, xShift: -2 },
  { id: 'suburb', palette: { bg: '#ede9fe', road: '#c4b5fd' }, incorrectIndex: 4, xShift: 1 },
  { id: 'coastline', palette: { bg: '#cffafe', road: '#67e8f9' }, incorrectIndex: 17, xShift: 3 },
  { id: 'night-city', palette: { bg: '#dbe4ff', road: '#93c5fd' }, incorrectIndex: 9, xShift: -1 },
]

const buildScenario = (seed: (typeof scenarioSeeds)[number]): Scenario => {
  const items: DetectionItem[] = Array.from({ length: 36 }, (_, index) => {
    const objectType = objectTypes[index % objectTypes.length]
    const base = baseBoxByType[objectType]
    const isIncorrect = index === seed.incorrectIndex

    return {
      id: `${seed.id}-img-${String(index + 1).padStart(2, '0')}`,
      objectType,
      isIncorrect,
      box: isIncorrect
        ? { x: 4, y: 6, w: 24, h: 16 }
        : {
            x: base.x,
            y: base.y,
            w: base.w,
            h: base.h,
          },
    }
  })

  return {
    id: seed.id,
    palette: seed.palette,
    items,
    incorrectId: items[seed.incorrectIndex].id,
  }
}

const scenarioPool = scenarioSeeds.map(buildScenario)

const qaPool: { year: string; model: string }[] = [
  { year: '1998', model: 'LeNet-5' },
  { year: '2012', model: 'AlexNet' },
  { year: '2014', model: 'GAN' },
  { year: '2014', model: 'VGG-16' },
  { year: '2014', model: 'Seq2Seq' },
  { year: '2015', model: 'ResNet' },
  { year: '2015', model: 'U-Net' },
  { year: '2015', model: 'Fast R-CNN' },
  { year: '2016', model: 'YOLOv1' },
  { year: '2016', model: 'WaveNet' },
  { year: '2016', model: 'AlphaGo' },
  { year: '2017', model: 'Transformer' },
  { year: '2017', model: 'MobileNet' },
  { year: '2017', model: 'Mask R-CNN' },
  { year: '2018', model: 'BERT' },
  { year: '2018', model: 'GPT-1' },
  { year: '2018', model: 'StyleGAN' },
  { year: '2019', model: 'GPT-2' },
  { year: '2019', model: 'RoBERTa' },
  { year: '2019', model: 'EfficientNet' },
  { year: '2020', model: 'GPT-3' },
  { year: '2020', model: 'DETR' },
  { year: '2020', model: 'ViT' },
  { year: '2021', model: 'CLIP' },
  { year: '2021', model: 'Swin Transformer' },
  { year: '2021', model: 'DALL-E' },
  { year: '2022', model: 'Stable Diffusion' },
  { year: '2022', model: 'Whisper' },
  { year: '2022', model: 'ChatGPT' },
  { year: '2023', model: 'Llama 2' },
  { year: '2023', model: 'SAM' },
  { year: '2023', model: 'Mistral 7B' },
  { year: '2024', model: 'Llama 3' },
  { year: '2024', model: 'Sora' },
  { year: '2024', model: 'Claude 3' },
  { year: '2013', model: 'ZFNet' },
  { year: '2014', model: 'R-CNN' },
  { year: '2015', model: 'Faster R-CNN' },
  { year: '2016', model: 'SSD' },
  { year: '2017', model: 'Capsule Network' },
  { year: '2017', model: 'RetinaNet' },
  { year: '2018', model: 'XLNet' },
  { year: '2019', model: 'T5' },
  { year: '2020', model: 'Reformer' },
  { year: '2021', model: 'Codex' },
  { year: '2022', model: 'PaLM' },
  { year: '2023', model: 'LLaVA' },
  { year: '2024', model: 'DBRX' },
  { year: '2024', model: 'Gemini 1.5' },
  { year: '2025', model: 'GPT-4.5' },
]

type Stage = 'detect' | 'quiz' | 'complete'

const pickAnotherIndex = (current: number, size: number): number => {
  if (size <= 1) {
    return 0
  }
  let candidate = current
  while (candidate === current) {
    candidate = Math.floor(Math.random() * size)
  }
  return candidate
}

const seededRandom = (seed: number) => {
  let value = seed | 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleWithSeed = <T,>(items: T[], seed: number): T[] => {
  const rng = seededRandom(seed)
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function App() {
  const [isActivated, setIsActivated] = useState(false)
  const [activationInput, setActivationInput] = useState('')
  const [activationLeft, setActivationLeft] = useState(attemptDurationSec)
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [roundId, setRoundId] = useState(1)
  const [stage, setStage] = useState<Stage>('detect')
  const [isQuizOpen, setIsQuizOpen] = useState(false)
  const [isResultOpen, setIsResultOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(roundDurationSec)
  const [quizLeft, setQuizLeft] = useState(quizDurationSec)
  const [revealLeft, setRevealLeft] = useState(revealDurationSec)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isSuccessToast, setIsSuccessToast] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const activeScenario = scenarioPool[scenarioIndex]
  const activeQuiz = useMemo<Quiz>(() => {
    const shuffled = shuffleWithSeed(qaPool, roundId * 97 + scenarioIndex * 17)
    const pairs = shuffled.slice(0, 3).map((pair) => ({
      id: `${pair.year}-${pair.model}`,
      year: pair.year,
      model: pair.model,
    }))
    const distractors = shuffled
      .slice(3)
      .map((item) => item.model)
      .filter((model, idx, arr) => arr.indexOf(model) === idx)
      .slice(0, 3)
    const options = [...pairs.map((pair) => pair.model), ...distractors]
      .filter((model, idx, arr) => arr.indexOf(model) === idx)
    const shuffledOptions = shuffleWithSeed(options, roundId * 131 + 11)

    return {
      id: `quiz-round-${roundId}`,
      title: `Сопоставление моделей (раунд ${roundId})`,
      prompt: 'Сопоставьте год и модель нейросети.',
      pairs,
      options: shuffledOptions,
    }
  }, [roundId, scenarioIndex])
  const cards = useMemo(
    () => activeScenario.items.map((item) => ({ ...item, imageSrc: imageForItem(item, activeScenario.palette) })),
    [activeScenario],
  )

  const startNewRound = () => {
    setScenarioIndex((prev) => pickAnotherIndex(prev, scenarioPool.length))
    setRoundId((prev) => prev + 1)
    setStage('detect')
    setAnswers({})
    setIsQuizOpen(false)
    setIsResultOpen(false)
    setTimeLeft(roundDurationSec)
    setQuizLeft(quizDurationSec)
    setRevealLeft(revealDurationSec)
    setIsSuccessToast(false)
    setToastMessage('Новый раунд запущен: изображения и вопросы обновлены.')
  }

  const endAttempt = () => {
    setIsActivated(false)
    setActivationInput('')
    setActivationLeft(attemptDurationSec)
    setScenarioIndex(0)
    setRoundId(1)
    setStage('detect')
    setAnswers({})
    setIsQuizOpen(false)
    setIsResultOpen(false)
    setTimeLeft(roundDurationSec)
    setQuizLeft(quizDurationSec)
    setRevealLeft(revealDurationSec)
    setIsSuccessToast(false)
    setToastMessage('Попытка завершена. Введите код активации для нового запуска.')
  }

  const handleActivate = () => {
    if (activationInput.trim() !== activationCode) {
      showToast('Неверный код активации.')
      return
    }

    setIsActivated(true)
    setActivationLeft(attemptDurationSec)
    setActivationInput('')
    startNewRound()
    setToastMessage('Сессия активирована. Время пошло.')
  }

  const showToast = (message: string) => {
    setIsSuccessToast(false)
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2500)
  }

  useEffect(() => {
    if (!isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setActivationLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId)
          endAttempt()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isActivated])

  useEffect(() => {
    if (!isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.setTimeout(startNewRound, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isActivated])

  useEffect(() => {
    if (!isResultOpen || !isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setRevealLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId)
          startNewRound()
          return revealDurationSec
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isResultOpen, isActivated])

  useEffect(() => {
    if (!isQuizOpen || !isActivated) {
      return
    }

    const timerId = window.setInterval(() => {
      setQuizLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId)
          showToast('Время на сопоставление вышло. Раунд перезапущен.')
          startNewRound()
          return quizDurationSec
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [isQuizOpen, isActivated])

  const onCardClick = (itemId: string) => {
    if (!isActivated || stage !== 'detect') {
      return
    }

    if (itemId !== activeScenario.incorrectId) {
      showToast('Это корректная рамка. Продолжайте поиск.')
      return
    }

    setStage('quiz')
    setIsQuizOpen(true)
    setQuizLeft(quizDurationSec)
    showToast('Ошибка найдена. Выполните сопоставление, чтобы получить ключ.')
  }

  const onAnswerChange = (year: string, model: string) => {
    setAnswers((prev) => ({ ...prev, [year]: model }))
  }

  const validateQuiz = () => {
    const hasMissing = activeQuiz.pairs.some((pair) => !answers[pair.id])
    if (hasMissing) {
      showToast('Заполните сопоставление для всех годов.')
      return
    }

    const isCorrect = activeQuiz.pairs.every((pair) => answers[pair.id] === pair.model)
    if (!isCorrect) {
      showToast('Сопоставление неверно. Раунд будет перезапущен.')
      startNewRound()
      return
    }

    const accessKey = String.fromCharCode(...keyCodePoints)
    setStage('complete')
    setIsQuizOpen(false)
    setIsResultOpen(true)
    setRevealLeft(revealDurationSec)
    setIsSuccessToast(false)
    setToastMessage(`Сопоставление верно. Ключ: ${accessKey}`)
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Найдите неверную рамку</h1>
        <p>
          Шаг 1: найдите кадр с ошибочной рамкой. Шаг 2: сопоставьте год и модель нейросети в
          всплывающем окне.
        </p>
        <div className="meta">
          <span className="pill">Сценарий: {activeScenario.id}</span>
          <span className="pill">Осталось: {timeLeft}s</span>
          <span className="pill">Сессия: {Math.floor(activationLeft / 60)}:{String(activationLeft % 60).padStart(2, '0')}</span>
          <button className="pillButton" type="button" onClick={startNewRound}>
            Перезапустить раунд
          </button>
          <button className="pillButton danger" type="button" onClick={endAttempt}>
            Закончить попытку
          </button>
        </div>
      </header>

      <section className="grid" aria-label="Сетка изображений с распознаванием объектов">
        {cards.map((item) => (
          <button
            key={item.id}
            className="card"
            type="button"
            onClick={() => onCardClick(item.id)}
            aria-label={`Кадр ${item.id}`}
            disabled={stage !== 'detect' || !isActivated}
          >
            <img src={item.imageSrc} alt={`Распознанный объект: ${item.objectType}`} loading="lazy" />
            <span>{item.id}</span>
          </button>
        ))}
      </section>

      {isQuizOpen ? (
        <div className="modalBackdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Сопоставление годов и моделей">
            <h2>{activeQuiz.title}</h2>
            <p>{activeQuiz.prompt}</p>
            <p className="countdownText">На ответ осталось: {quizLeft} сек.</p>
            <div className="quizRows">
              {activeQuiz.pairs.map((pair) => (
                <label key={pair.id} className="quizRow">
                  <span>{pair.year}</span>
                  <select
                    value={answers[pair.id] ?? ''}
                    onChange={(event) => onAnswerChange(pair.id, event.target.value)}
                  >
                    <option value="">Выберите модель</option>
                    {activeQuiz.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="modalActions">
              <button type="button" onClick={validateQuiz}>
                Проверить соответствие
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isResultOpen ? (
        <div className="modalBackdrop" role="presentation">
          <div className="modal resultModal" role="dialog" aria-modal="true" aria-label="Ключ доступа">
            <h2>Ответ принят</h2>
            <p>
              Ключ доступа: <code>{String.fromCharCode(...keyCodePoints)}</code>
            </p>
            <p className="countdownText">Новый раунд начнется через {revealLeft} сек.</p>
            <div className="modalActions center">
              <button type="button" onClick={startNewRound}>
                Закрыть и начать заново
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={`toast ${isSuccessToast ? 'success' : ''}`} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      {!isActivated ? (
        <div className="modalBackdrop" role="presentation">
          <div className="modal activationModal" role="dialog" aria-modal="true" aria-label="Активация">
            <h2>Активация попытки</h2>
            <p>Введите код активации, чтобы начать.</p>
            <div className="activationRow">
              <input
                type="password"
                value={activationInput}
                onChange={(event) => setActivationInput(event.target.value)}
                placeholder="Код активации"
              />
              <button type="button" onClick={handleActivate}>
                Активировать
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
