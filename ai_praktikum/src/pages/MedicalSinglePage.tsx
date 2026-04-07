import { useEffect, useState } from 'react'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'

const symptoms = [
  'Насморк',
  'Кашель',
  'Хрипы',
  'Чихание',
  'Тошнота',
  'Сухость горла',
  'Боли в животе',
  'Температура',
  'Болезненность горла',
  'Головные боли',
  'Отсутствие аппетита',
  'Нарушение сна',
  'Расстройство кишечника',
  'Слабость',
  'Потеря памяти',
  'Боли в мышцах',
] as const

interface MedicalSinglePageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function MedicalSinglePage({ onProgressChange }: MedicalSinglePageProps) {
  type Sample = { id: number; features: number[]; target: 0 | 1 }
  type Model = { weights: number[]; bias: number }

  const [selected, setSelected] = useState<boolean[]>(
    Array.from({ length: symptoms.length }, () => false),
  )
  const [target, setTarget] = useState<0 | 1>(1)
  const [samples, setSamples] = useState<Sample[]>([])
  const [nextId, setNextId] = useState(1)
  const [hiddenNeurons, setHiddenNeurons] = useState(3)
  const [model, setModel] = useState<Model | null>(null)
  const [diagnosis, setDiagnosis] = useState<0 | 1 | null>(null)
  const [isTrained, setIsTrained] = useState(false)
  const [hasSuccessfulCheck, setHasSuccessfulCheck] = useState(false)
  const [message, setMessage] = useState('Добавьте обучающие примеры и обучите сеть.')

  useEffect(() => {
    onProgressChange?.(isTrained && hasSuccessfulCheck)
  }, [hasSuccessfulCheck, isTrained, onProgressChange])

  const toggleSymptom = (idx: number) => {
    setSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)))
  }

  const clearInput = () => {
    setSelected(Array.from({ length: symptoms.length }, () => false))
    setDiagnosis(null)
  }

  const addSample = () => {
    const features = selected.map((v) => (v ? 1 : 0))
    if (features.every((value) => value === 0)) {
      setMessage('Отметьте хотя бы один симптом.')
      return
    }
    setSamples((prev) => [...prev, { id: nextId, features, target }])
    setNextId((prev) => prev + 1)
    setMessage('Пример добавлен.')
  }

  const removeSample = (id: number) => {
    setSamples((prev) => prev.filter((sample) => sample.id !== id))
    setMessage('Пример удален.')
  }

  const train = () => {
    if (samples.length < 4) {
      setMessage('Для обучения нужно минимум 4 примера.')
      return
    }
    const hasPositive = samples.some((s) => s.target === 1)
    const hasNegative = samples.some((s) => s.target === 0)
    if (!hasPositive || !hasNegative) {
      setMessage('Нужны примеры обоих классов: болен/не болен.')
      return
    }

    const weights = Array.from({ length: symptoms.length }, () => 0)
    let bias = 0
    for (let epoch = 0; epoch < 120; epoch += 1) {
      let errors = 0
      for (const sample of samples) {
        const sum =
          sample.features.reduce((acc, value, index) => acc + value * weights[index], bias)
        const predicted: 0 | 1 = sum >= 0 ? 1 : 0
        const delta = sample.target - predicted
        if (delta !== 0) {
          errors += 1
          for (let i = 0; i < weights.length; i += 1) {
            weights[i] += 0.15 * delta * sample.features[i]
          }
          bias += 0.15 * delta
        }
      }
      if (errors === 0) {
        break
      }
    }
    setModel({ weights, bias })
    setIsTrained(true)
    setHasSuccessfulCheck(false)
    setMessage('Обучение завершено. Выполните постановку диагноза.')
  }

  const infer = () => {
    if (!model) {
      setMessage('Сначала обучите сеть.')
      return
    }
    const features = selected.map((v) => (v ? 1 : 0))
    const sum = features.reduce(
      (acc, value, index) => acc + value * model.weights[index],
      model.bias,
    )
    const predicted: 0 | 1 = sum >= 0 ? 1 : 0
    setDiagnosis(predicted)
    const success = predicted === target
    setHasSuccessfulCheck((prev) => prev || success)
    setMessage(
      success
        ? 'Проверка успешна. Можно переходить дальше.'
        : 'Проверка неуспешна. Попробуйте другие примеры/обучение.',
    )
  }

  const shownHiddenNeurons = Math.max(1, Math.min(hiddenNeurons, 8))
  const activeSymptomIndexes = selected
    .map((isActive, idx) => (isActive ? idx : -1))
    .filter((idx) => idx >= 0)
  const visibleInputCount = Math.min(symptoms.length, 10)
  const inputYs = Array.from({ length: visibleInputCount }, (_, idx) => {
    if (visibleInputCount <= 1) {
      return 88
    }
    return 28 + (idx * 120) / (visibleInputCount - 1)
  })
  const hiddenYs = Array.from({ length: shownHiddenNeurons }, (_, idx) => {
    if (shownHiddenNeurons <= 1) {
      return 88
    }
    return 28 + (idx * 120) / (shownHiddenNeurons - 1)
  })

  return (
    <section className="lab-page">
      <PageHero
        title="Диагноз: болен ли пациент гриппом?"
        task="Обучить сеть бинарной классификации по симптомам."
      />

      <section className="lab-grid lab-grid-3">
        <article className="panel">
          <h3>Вход сети</h3>
          <div className="checkbox-grid">
            {symptoms.map((symptom, idx) => (
              <label key={symptom}>
                <input
                  type="checkbox"
                  checked={selected[idx]}
                  onChange={() => toggleSymptom(idx)}
                />{' '}
                {symptom}
              </label>
            ))}
          </div>
        </article>
        <article className="panel">
          <h3>Скрытые слои</h3>
          <label>
            Количество нейронов
            <input
              type="number"
              min={1}
              max={8}
              value={hiddenNeurons}
              onChange={(event) => setHiddenNeurons(Number(event.target.value))}
            />
          </label>
          <p className="subtle">Значение можно менять перед обучением.</p>
        </article>
        <article className="panel">
          <h3>Выход сети</h3>
          <label className="output-check">
            <input
              type="checkbox"
              checked={target === 1}
              onChange={(e) => setTarget(e.target.checked ? 1 : 0)}
            />{' '}
            Болен гриппом
          </label>
          <p className="subtle">Ожидаемый класс: {target === 1 ? 'болен' : 'не болен'}</p>
        </article>
      </section>

      <section className="lab-grid lab-grid-2">
        <article className="panel">
          <h3>Обучающие примеры</h3>
          {samples.length === 0 ? (
            <div className="dataset-placeholder">Список обучающих примеров</div>
          ) : (
            <ul className="sample-list">
              {samples.map((sample) => (
                <li key={sample.id} className="sample-item">
                  <div className="sample-meta">
                    <strong>Пример #{sample.id}</strong>
                    <span>{sample.target === 1 ? 'болен' : 'не болен'}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => removeSample(sample.id)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
        <ProtocolPanel
          lines={[
            'Отметьте симптомы и целевой диагноз.',
            'Добавьте примеры в обучающую выборку.',
            'Запустите обучение и выполните постановку диагноза.',
            'Переход далее только после успешной проверки.',
            message,
          ]}
        />
      </section>

      <section className="lab-grid lab-grid-2">
        <article className="panel">
          <h3>Обучение сети</h3>
          <div className="form-col">
            <label>
              Скорость обучения
              <input type="number" step="0.01" defaultValue={0.3} />
            </label>
            <label>
              Количество эпох
              <input type="number" defaultValue={200} />
            </label>
          </div>
        </article>
        <article className="panel">
          <h3>Структура сети</h3>
          <div className="viz-frame">
            <svg
              viewBox="0 0 420 170"
              className="medical-network-svg"
              role="img"
              aria-label="Структура медицинской сети"
            >
              <defs>
                <marker
                  id="medicalArrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                </marker>
              </defs>

              <text x="16" y="16" fontSize="12" fill="#334155">
                Вход ({symptoms.length})
              </text>
              <text x="162" y="16" fontSize="12" fill="#334155">
                Скрытый ({shownHiddenNeurons})
              </text>
              <text x="347" y="16" fontSize="12" fill="#334155">
                Выход
              </text>

              {inputYs.map((inputY, inputIdx) =>
                hiddenYs.map((hiddenY, hiddenIdx) => {
                  const isActive = activeSymptomIndexes.includes(inputIdx)
                  return (
                    <line
                      key={`edge-${inputIdx}-${hiddenIdx}`}
                      x1="44"
                      y1={inputY}
                      x2="202"
                      y2={hiddenY}
                      stroke={isActive ? '#60a5fa' : '#d1d5db'}
                      strokeWidth={isActive ? 1.4 : 1}
                      markerEnd="url(#medicalArrow)"
                      opacity={isActive ? 0.95 : 0.6}
                    />
                  )
                }),
              )}

              {inputYs.map((inputY, inputIdx) => {
                const isActive = activeSymptomIndexes.includes(inputIdx)
                return (
                  <circle
                    key={`input-${inputIdx}`}
                    cx="36"
                    cy={inputY}
                    r="7"
                    fill={isActive ? '#bfdbfe' : '#e2e8f0'}
                    stroke={isActive ? '#2563eb' : '#94a3b8'}
                  />
                )
              })}

              {hiddenYs.map((hiddenY, hiddenIdx) => (
                <g key={`hidden-${hiddenIdx}`}>
                  <circle cx="210" cy={hiddenY} r="8" fill="#dcfce7" stroke="#4ade80" />
                  <line
                    x1="218"
                    y1={hiddenY}
                    x2="358"
                    y2="84"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    markerEnd="url(#medicalArrow)"
                  />
                </g>
              ))}

              <circle
                cx="372"
                cy="84"
                r="11"
                fill={target === 1 ? '#fef3c7' : '#ede9fe'}
                stroke={target === 1 ? '#f59e0b' : '#8b5cf6'}
              />
              <text x="366" y="88" fontSize="10" fill="#1f2937">
                y
              </text>
            </svg>
          </div>
        </article>
      </section>

      <article className="panel">
        <h3>Постановка диагноза</h3>
        <div className="action-row">
          <button type="button" onClick={addSample}>
            Добавить пример
          </button>
          <button type="button" onClick={train}>
            Обучить
          </button>
          <button type="button" onClick={infer}>
            Поставить диагноз
          </button>
          <button type="button" className="ghost" onClick={clearInput}>
            Очистить вход
          </button>
          <span className="result-chip">
            Диагноз: {diagnosis === null ? 'не рассчитан' : diagnosis === 1 ? 'болен' : 'не болен'}
          </span>
        </div>
      </article>
    </section>
  )
}
