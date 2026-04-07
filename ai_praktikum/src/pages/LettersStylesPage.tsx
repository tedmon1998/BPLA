import { useEffect, useMemo, useState } from 'react'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'

interface LettersStylesPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function LettersStylesPage({ onProgressChange }: LettersStylesPageProps) {
  const GRID_ROWS = 10
  const GRID_COLS = 8
  const GRID_SIZE = GRID_ROWS * GRID_COLS
  const CLASSES = ['A', 'B', 'C'] as const
  const STYLES = ['Печатный', 'Рукописный'] as const
  type LetterClass = (typeof CLASSES)[number]
  type LetterStyle = (typeof STYLES)[number]
  interface Sample {
    id: number
    pixels: number[]
    label: LetterClass
    style: LetterStyle
  }
  interface Model {
    weights: number[][]
    bias: number[]
  }

  const [cells, setCells] = useState<number[]>(Array.from({ length: GRID_SIZE }, () => 0))
  const [samples, setSamples] = useState<Sample[]>([])
  const [nextId, setNextId] = useState(1)
  const [label, setLabel] = useState<LetterClass>('A')
  const [style, setStyle] = useState<LetterStyle>('Печатный')
  const [model, setModel] = useState<Model | null>(null)
  const [classification, setClassification] = useState<LetterClass | null>(null)
  const [isTrained, setIsTrained] = useState(false)
  const [hasSuccessfulCheck, setHasSuccessfulCheck] = useState(false)
  const [message, setMessage] = useState('Добавьте примеры печатных и рукописных букв.')

  const filled = useMemo(() => cells.reduce((s, v) => s + v, 0), [cells])

  const argMax = (values: number[]): number => {
    let max = 0
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[max]) {
        max = i
      }
    }
    return max
  }

  const toggleCell = (index: number) => {
    setCells((prev) => prev.map((v, i) => (i === index ? (v === 1 ? 0 : 1) : v)))
  }

  const clearGrid = () => {
    setCells(Array.from({ length: GRID_SIZE }, () => 0))
    setClassification(null)
  }

  const addSample = () => {
    if (filled === 0) {
      setMessage('Сетка пустая. Нарисуйте символ перед добавлением.')
      return
    }
    setSamples((prev) => [...prev, { id: nextId, pixels: [...cells], label, style }])
    setNextId((prev) => prev + 1)
    setMessage(`Пример ${label} (${style}) добавлен.`)
  }

  const clearSamples = () => {
    setSamples([])
    setModel(null)
    setIsTrained(false)
    setHasSuccessfulCheck(false)
    setMessage('Все примеры удалены.')
  }

  const removeSample = (id: number) => {
    setSamples((prev) => prev.filter((s) => s.id !== id))
  }

  const train = () => {
    if (samples.length < 6) {
      setMessage('Добавьте минимум 6 примеров.')
      return
    }
    const allClasses = CLASSES.every((c) => samples.some((s) => s.label === c))
    const allStyles = STYLES.every((st) => samples.some((s) => s.style === st))
    if (!allClasses || !allStyles) {
      setMessage('Нужны все классы A/B/C и оба стиля: печатный и рукописный.')
      return
    }

    const weights = CLASSES.map(() => Array.from({ length: GRID_SIZE }, () => 0))
    const bias = CLASSES.map(() => 0)
    for (let epoch = 0; epoch < 180; epoch += 1) {
      let errors = 0
      for (const sample of samples) {
        const scores = weights.map((classWeights, classIdx) => {
          let sum = bias[classIdx]
          for (let i = 0; i < GRID_SIZE; i += 1) {
            sum += sample.pixels[i] * classWeights[i]
          }
          return sum
        })
        const predictedIdx = argMax(scores)
        const targetIdx = CLASSES.indexOf(sample.label)
        if (predictedIdx !== targetIdx) {
          errors += 1
          for (let i = 0; i < GRID_SIZE; i += 1) {
            weights[targetIdx][i] += 0.1 * sample.pixels[i]
            weights[predictedIdx][i] -= 0.1 * sample.pixels[i]
          }
          bias[targetIdx] += 0.1
          bias[predictedIdx] -= 0.1
        }
      }
      if (errors === 0) {
        break
      }
    }
    setModel({ weights, bias })
    setIsTrained(true)
    setHasSuccessfulCheck(false)
    setMessage('Обучение завершено. Выполните проверку.')
  }

  const classify = () => {
    if (!model) {
      setMessage('Сначала обучите модель.')
      return
    }
    const scores = model.weights.map((classWeights, classIdx) => {
      let sum = model.bias[classIdx]
      for (let i = 0; i < GRID_SIZE; i += 1) {
        sum += cells[i] * classWeights[i]
      }
      return sum
    })
    const predicted = CLASSES[argMax(scores)]
    setClassification(predicted)
    const success = predicted === label
    setHasSuccessfulCheck((prev) => prev || success)
    setMessage(
      success
        ? `Проверка успешна: ${predicted}.`
        : `Проверка неуспешна: ожидалось ${label}, получено ${predicted}.`,
    )
  }

  useEffect(() => {
    onProgressChange?.(isTrained && hasSuccessfulCheck)
  }, [hasSuccessfulCheck, isTrained, onProgressChange])

  return (
    <section className="lab-page">
      <PageHero
        title="Печатные и рукописные буквы"
        task="Обучить модель распознавать A/B/C в разных стилях написания."
      />
      <section className="lab-grid lab-grid-3">
        <article className="panel">
          <h3>Вход перцептрона</h3>
          <div className="draw-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
            {cells.map((value, index) => (
              <button
                key={index}
                type="button"
                className={value === 1 ? 'draw-cell draw-cell-on' : 'draw-cell'}
                onClick={() => toggleCell(index)}
              />
            ))}
          </div>
          <p className="subtle">Закрашено клеток: {filled}</p>
        </article>
        <article className="panel">
          <h3>Выход перцептрона</h3>
          <div className="output-stack">
            {CLASSES.map((letter) => (
              <button
                key={letter}
                type="button"
                className={label === letter ? 'pill pill-active' : 'pill'}
                onClick={() => setLabel(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
          <label>
            Стиль
            <select value={style} onChange={(e) => setStyle(e.target.value as LetterStyle)}>
              {STYLES.map((styleValue) => (
                <option key={styleValue} value={styleValue}>
                  {styleValue}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row">
            <button type="button" onClick={addSample}>
              Добавить пример
            </button>
            <button type="button" onClick={train}>
              Обучить
            </button>
            <button type="button" onClick={classify}>
              Классифицировать
            </button>
            <button type="button" className="ghost" onClick={clearGrid}>
              Сбросить сетку
            </button>
            <button type="button" className="ghost" onClick={clearSamples}>
              Очистить примеры
            </button>
          </div>
          <p className="subtle">Результат: {classification ?? 'нет'}</p>
        </article>
        <ProtocolPanel
          lines={[
            'Добавьте варианты печатного и рукописного написания.',
            'Сформируйте расширенный датасет по каждому классу.',
            'Проведите обучение и сравните распознавание стилей.',
            'Переход дальше только после успешной проверки примера.',
            message,
          ]}
        />
      </section>
      <article className="panel">
        <h3>Множество обучающих примеров</h3>
        {samples.length === 0 ? (
          <div className="dataset-placeholder">Датасет стилей пока пуст.</div>
        ) : (
          <ul className="sample-list">
            {samples.map((sample) => (
              <li key={sample.id} className="sample-item">
                <div className="sample-meta">
                  <strong>#{sample.id}</strong>
                  <span>
                    {sample.label} / {sample.style}
                  </span>
                </div>
                <button type="button" className="ghost" onClick={() => removeSample(sample.id)}>
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
