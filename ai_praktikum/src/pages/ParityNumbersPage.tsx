import { useEffect, useMemo, useState } from 'react'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'
import {
  type BinaryModel,
  predictBinary,
  trainBinaryPerceptron,
} from '../domain/ml/perceptron'

const GRID_ROWS = 10
const GRID_COLS = 8
const GRID_SIZE = GRID_ROWS * GRID_COLS
const TRAINING_LEARNING_RATE = 0.1
const TRAINING_EPOCHS = 120

type ParityLabel = 0 | 1

interface TrainingSample {
  id: number
  pixels: number[]
  label: ParityLabel
}

interface ParityNumbersPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function ParityNumbersPage({ onProgressChange }: ParityNumbersPageProps) {
  const [cells, setCells] = useState<number[]>(
    Array.from({ length: GRID_SIZE }, () => 0),
  )
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [nextId, setNextId] = useState(1)
  const [label, setLabel] = useState<ParityLabel>(1)
  const [model, setModel] = useState<BinaryModel | null>(null)
  const [trainingHistory, setTrainingHistory] = useState<number[]>([])
  const [classification, setClassification] = useState<ParityLabel | null>(null)
  const [isTrained, setIsTrained] = useState(false)
  const [hasSuccessfulCheck, setHasSuccessfulCheck] = useState(false)
  const [message, setMessage] = useState('Добавьте примеры и запустите обучение.')
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
      setMessage('Сетка пустая. Нарисуйте образ перед добавлением.')
      return
    }

    setSamples((prev) => [...prev, { id: nextId, pixels: [...cells], label }])
    setNextId((prev) => prev + 1)
    setMessage('Пример добавлен.')
  }

  const removeSample = (id: number) => {
    setSamples((prev) => prev.filter((sample) => sample.id !== id))
    setMessage('Пример удален.')
  }

  const train = () => {
    if (samples.length < 2) {
      setMessage('Для обучения нужно минимум 2 примера.')
      return
    }

    const hasEven = samples.some((sample) => sample.label === 1)
    const hasOdd = samples.some((sample) => sample.label === 0)
    if (!hasEven || !hasOdd) {
      setMessage('Нужны примеры обоих классов: четное и нечетное.')
      return
    }

    const trained = trainBinaryPerceptron(
      samples.map((sample) => ({ features: sample.pixels, label: sample.label })),
      {
        learningRate: TRAINING_LEARNING_RATE,
        epochs: TRAINING_EPOCHS,
        seed: 20260401,
      },
    )
    setModel(trained.model)
    setTrainingHistory(trained.errorHistory)
    setIsTrained(true)
    setHasSuccessfulCheck(false)
    setMessage(
      `Обучение завершено. Эпох: ${trained.epochsUsed}, ошибка последней эпохи: ${
        trained.errorHistory[trained.errorHistory.length - 1] ?? 0
      }.`,
    )
  }

  const classify = () => {
    if (!model) {
      setMessage('Сначала обучите перцептрон.')
      return
    }

    const predicted = predictBinary(cells, model)
    setClassification(predicted)
    const isSuccess = predicted === label
    setHasSuccessfulCheck((prev) => prev || isSuccess)
    setMessage(
      isSuccess
        ? `Проверка успешна: ${predicted === 1 ? 'Четное' : 'Нечетное'}. Можно перейти дальше.`
        : `Проверка неуспешна: ожидалось ${
            label === 1 ? 'Четное' : 'Нечетное'
          }, получено ${predicted === 1 ? 'Четное' : 'Нечетное'}.`,
    )
  }

  const clearSamples = () => {
    setSamples([])
    setModel(null)
    setTrainingHistory([])
    setIsTrained(false)
    setHasSuccessfulCheck(false)
    setMessage('Все обучающие примеры удалены.')
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
        title="Четные / нечетные числа"
        task="Обучить однослойный перцептрон классифицировать цифры на четные и нечетные."
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
            <button
              type="button"
              className={label === 1 ? 'pill pill-active' : 'pill'}
              onClick={() => setLabel(1)}
            >
              Четное
            </button>
            <button
              type="button"
              className={label === 0 ? 'pill pill-active' : 'pill'}
              onClick={() => setLabel(0)}
            >
              Нечетное
            </button>
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
          <p className="subtle">
            Результат: {classification === null ? 'нет' : classification === 1 ? 'четное' : 'нечетное'}
          </p>
          <p className="subtle">
            История ошибок: {trainingHistory.length === 0 ? 'нет' : trainingHistory.join(', ')}
          </p>
        </article>

        <ProtocolPanel
          lines={[
            'Сформируйте обучающую выборку (минимум 2 примера разных классов).',
            'Выберите кнопку "Четное" или "Нечетное" и добавьте образ.',
            'Запустите обучение и проверьте классификацию (параметры фиксированы).',
            'Переход на следующий уровень доступен только после успешной проверки.',
            message,
          ]}
        />
      </section>

      <article className="panel">
        <h3>Множество обучающих примеров</h3>
        {samples.length === 0 ? (
          <div className="dataset-placeholder">Список примеров пока пуст.</div>
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
                  <span>{sample.label === 1 ? 'четное' : 'нечетное'}</span>
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
