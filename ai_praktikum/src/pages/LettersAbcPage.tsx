import { useEffect, useMemo, useState } from 'react'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'
import {
  type MultiClassModel,
  predictMultiClass,
  trainMultiClassPerceptron,
} from '../domain/ml/perceptron'

interface LettersAbcPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

const GRID_ROWS = 10
const GRID_COLS = 8
const GRID_SIZE = GRID_ROWS * GRID_COLS
const TRAINING_LEARNING_RATE = 0.1
const TRAINING_EPOCHS = 160
const CLASSES = ['A', 'B', 'C'] as const

type LetterClass = (typeof CLASSES)[number]

interface TrainingSample {
  id: number
  pixels: number[]
  label: LetterClass
}

export function LettersAbcPage({ onProgressChange }: LettersAbcPageProps) {
  const [cells, setCells] = useState<number[]>(
    Array.from({ length: GRID_SIZE }, () => 0),
  )
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [nextId, setNextId] = useState(1)
  const [label, setLabel] = useState<LetterClass>('A')
  const [model, setModel] = useState<MultiClassModel<LetterClass> | null>(null)
  const [trainingHistory, setTrainingHistory] = useState<number[]>([])
  const [classification, setClassification] = useState<LetterClass | null>(null)
  const [isTrained, setIsTrained] = useState(false)
  const [hasSuccessfulCheck, setHasSuccessfulCheck] = useState(false)
  const [message, setMessage] = useState('Добавьте примеры для A/B/C и запустите обучение.')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawValue, setDrawValue] = useState<0 | 1>(1)

  const paintedCellsCount = useMemo(
    () => cells.reduce((acc, value) => acc + value, 0),
    [cells],
  )

  const setCellValue = (index: number, value: 0 | 1) => {
    setCells((prev) => prev.map((cell, i) => (i === index ? value : cell)))
  }

  const handleCellPointerDown = (index: number) => {
    const nextValue: 0 | 1 = cells[index] === 1 ? 0 : 1
    setDrawValue(nextValue)
    setIsDrawing(true)
    setCellValue(index, nextValue)
  }

  const handleCellPointerEnter = (index: number) => {
    if (!isDrawing) {
      return
    }
    setCellValue(index, drawValue)
  }

  const clearGrid = () => {
    setCells(Array.from({ length: GRID_SIZE }, () => 0))
    setClassification(null)
  }

  const addSample = () => {
    if (paintedCellsCount === 0) {
      setMessage('Сетка пустая. Нарисуйте букву перед добавлением.')
      return
    }

    setSamples((prev) => [...prev, { id: nextId, pixels: [...cells], label }])
    setNextId((prev) => prev + 1)
    setMessage(`Пример для класса ${label} добавлен.`)
  }

  const removeSample = (id: number) => {
    setSamples((prev) => prev.filter((sample) => sample.id !== id))
    setMessage('Пример удален.')
  }

  const clearSamples = () => {
    setSamples([])
    setModel(null)
    setTrainingHistory([])
    setIsTrained(false)
    setHasSuccessfulCheck(false)
    setMessage('Все обучающие примеры удалены.')
  }

  const train = () => {
    if (samples.length < 3) {
      setMessage('Для обучения нужно минимум 3 примера.')
      return
    }

    const hasAllClasses = CLASSES.every((letter) =>
      samples.some((sample) => sample.label === letter),
    )
    if (!hasAllClasses) {
      setMessage('Нужны примеры всех классов: A, B, C.')
      return
    }

    const trainedModel = trainMultiClassPerceptron<LetterClass>(
      samples.map((sample) => ({ features: sample.pixels, label: sample.label })),
      CLASSES,
      {
        learningRate: TRAINING_LEARNING_RATE,
        epochs: TRAINING_EPOCHS,
        seed: 20260402,
      },
    )
    setModel(trainedModel.model)
    setTrainingHistory(trainedModel.errorHistory)
    setIsTrained(true)
    setHasSuccessfulCheck(false)
    setMessage(
      `Обучение завершено. Эпох: ${trainedModel.epochsUsed}, последняя ошибка: ${
        trainedModel.errorHistory[trainedModel.errorHistory.length - 1] ?? 0
      }.`,
    )
  }

  const classify = () => {
    if (!model) {
      setMessage('Сначала обучите модель.')
      return
    }

    const predicted = predictMultiClass(cells, model)
    setClassification(predicted)
    const isSuccess = predicted === label
    setHasSuccessfulCheck((prev) => prev || isSuccess)
    setMessage(
      isSuccess
        ? `Проверка успешна: распознано ${predicted}. Можно перейти дальше.`
        : `Проверка неуспешна: ожидалось ${label}, получено ${predicted}.`,
    )
  }

  useEffect(() => {
    onProgressChange?.(isTrained && hasSuccessfulCheck)
  }, [hasSuccessfulCheck, isTrained, onProgressChange])

  useEffect(() => {
    const stopDrawing = () => setIsDrawing(false)
    window.addEventListener('pointerup', stopDrawing)
    return () => window.removeEventListener('pointerup', stopDrawing)
  }, [])

  return (
    <section className="lab-page">
      <PageHero
        title="Распознавание букв A/B/C"
        task="Обучить модель распознавать буквы A, B, C по бинарной сетке."
      />
      <section className="lab-grid lab-grid-3">
        <article className="panel">
          <h3>Вход перцептрона</h3>
          <div
            className="draw-grid"
            style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
            onPointerLeave={() => setIsDrawing(false)}
          >
            {cells.map((value, index) => (
              <button
                key={index}
                type="button"
                className={value === 1 ? 'draw-cell draw-cell-on' : 'draw-cell'}
                onPointerDown={() => handleCellPointerDown(index)}
                onPointerEnter={() => handleCellPointerEnter(index)}
                aria-label={`Ячейка ${index + 1}`}
              />
            ))}
          </div>
          <p className="subtle">Закрашено клеток: {paintedCellsCount}</p>
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
            <button type="button" className="ghost" onClick={clearSamples}>
              Удалить все примеры
            </button>
            <button type="button" className="ghost" onClick={clearGrid}>
              Очистить сетку
            </button>
          </div>
          <p className="subtle">Результат: {classification ?? 'нет'}</p>
          <p className="subtle">
            История ошибок: {trainingHistory.length === 0 ? 'нет' : trainingHistory.join(', ')}
          </p>
        </article>

        <ProtocolPanel
          lines={[
            'Добавьте обучающие примеры для A/B/C.',
            'Запустите обучение многоклассового перцептрона.',
            'Проверьте распознавание: переход дальше после успешной проверки.',
            message,
          ]}
        />
      </section>

      <article className="panel">
        <h3>Множество обучающих примеров</h3>
        {samples.length === 0 ? (
          <div className="dataset-placeholder">Пока нет добавленных примеров.</div>
        ) : (
          <ul className="sample-list">
            {samples.map((sample) => (
              <li key={sample.id} className="sample-item">
                <div
                  className="sample-mini-grid"
                  style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
                >
                  {sample.pixels.map((pixel, index) => (
                    <span
                      key={index}
                      className={pixel === 1 ? 'mini-cell mini-cell-on' : 'mini-cell'}
                    />
                  ))}
                </div>
                <div className="sample-meta">
                  <strong>Пример #{sample.id}</strong>
                  <span>класс: {sample.label}</span>
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
