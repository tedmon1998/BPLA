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
  'Боли в груди',
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

interface MedicalMultiPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function MedicalMultiPage({ onProgressChange }: MedicalMultiPageProps) {
  const DIAGNOSES = ['Пневмония', 'ОРЗ', 'Здоров'] as const
  type Diagnosis = (typeof DIAGNOSES)[number]
  type Sample = { id: number; features: number[]; label: Diagnosis }
  type Model = { weights: number[][]; bias: number[] }

  const [selected, setSelected] = useState<boolean[]>(
    Array.from({ length: symptoms.length }, () => false),
  )
  const [label, setLabel] = useState<Diagnosis>('Пневмония')
  const [samples, setSamples] = useState<Sample[]>([])
  const [nextId, setNextId] = useState(1)
  const [hiddenNeurons, setHiddenNeurons] = useState(3)
  const [model, setModel] = useState<Model | null>(null)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [isTrained, setIsTrained] = useState(false)
  const [hasSuccessfulCheck, setHasSuccessfulCheck] = useState(false)
  const [message, setMessage] = useState('Добавьте обучающие примеры и обучите модель.')

  useEffect(() => {
    onProgressChange?.(isTrained && hasSuccessfulCheck)
  }, [hasSuccessfulCheck, isTrained, onProgressChange])

  const argMax = (values: number[]): number => {
    let max = 0
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[max]) {
        max = i
      }
    }
    return max
  }

  const toggleSymptom = (idx: number) => {
    setSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)))
  }

  const clearInput = () => {
    setSelected(Array.from({ length: symptoms.length }, () => false))
    setDiagnosis(null)
  }

  const addSample = () => {
    const features = selected.map((v) => (v ? 1 : 0))
    if (features.every((v) => v === 0)) {
      setMessage('Отметьте хотя бы один симптом.')
      return
    }
    setSamples((prev) => [...prev, { id: nextId, features, label }])
    setNextId((prev) => prev + 1)
    setMessage(`Пример для класса "${label}" добавлен.`)
  }

  const train = () => {
    if (samples.length < 6) {
      setMessage('Для обучения добавьте минимум 6 примеров.')
      return
    }
    const allClasses = DIAGNOSES.every((d) => samples.some((s) => s.label === d))
    if (!allClasses) {
      setMessage('Нужны примеры всех диагнозов: Пневмония, ОРЗ, Здоров.')
      return
    }

    const weights = DIAGNOSES.map(() => Array.from({ length: symptoms.length }, () => 0))
    const bias = DIAGNOSES.map(() => 0)

    for (let epoch = 0; epoch < 160; epoch += 1) {
      let errors = 0
      for (const sample of samples) {
        const scores = DIAGNOSES.map((_, classIdx) => {
          let sum = bias[classIdx]
          for (let i = 0; i < symptoms.length; i += 1) {
            sum += sample.features[i] * weights[classIdx][i]
          }
          return sum
        })
        const predictedIdx = argMax(scores)
        const targetIdx = DIAGNOSES.indexOf(sample.label)
        if (predictedIdx !== targetIdx) {
          errors += 1
          for (let i = 0; i < symptoms.length; i += 1) {
            weights[targetIdx][i] += 0.12 * sample.features[i]
            weights[predictedIdx][i] -= 0.12 * sample.features[i]
          }
          bias[targetIdx] += 0.12
          bias[predictedIdx] -= 0.12
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
      setMessage('Сначала обучите модель.')
      return
    }
    const features = selected.map((v) => (v ? 1 : 0))
    const scores = DIAGNOSES.map((_, classIdx) => {
      let sum = model.bias[classIdx]
      for (let i = 0; i < symptoms.length; i += 1) {
        sum += features[i] * model.weights[classIdx][i]
      }
      return sum
    })
    const predicted = DIAGNOSES[argMax(scores)]
    setDiagnosis(predicted)
    const success = predicted === label
    setHasSuccessfulCheck((prev) => prev || success)
    setMessage(
      success
        ? 'Проверка успешна. Можно переходить дальше.'
        : `Проверка неуспешна: ожидалось "${label}", получено "${predicted}".`,
    )
  }

  const shownHiddenNeurons = Math.max(1, Math.min(hiddenNeurons, 8))
  const visibleInputCount = Math.min(symptoms.length, 10)
  const inputYs = Array.from({ length: visibleInputCount }, (_, idx) => {
    if (visibleInputCount <= 1) {
      return 88
    }
    return 26 + (idx * 122) / (visibleInputCount - 1)
  })
  const hiddenYs = Array.from({ length: shownHiddenNeurons }, (_, idx) => {
    if (shownHiddenNeurons <= 1) {
      return 88
    }
    return 26 + (idx * 122) / (shownHiddenNeurons - 1)
  })
  const outputYs = [44, 86, 128]

  return (
    <section className="lab-page">
      <PageHero
        title="Несколько диагнозов"
        task="Обучить многоклассовую модель постановке одного из диагнозов."
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
        </article>
        <article className="panel">
          <h3>Выход сети</h3>
          <div className="form-col">
            {DIAGNOSES.map((diagnosisName) => (
              <button
                key={diagnosisName}
                type="button"
                className={label === diagnosisName ? 'pill pill-active' : 'pill'}
                onClick={() => setLabel(diagnosisName)}
              >
                {diagnosisName}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="lab-grid lab-grid-2">
        <article className="panel">
          <h3>Обучающие примеры</h3>
          {samples.length === 0 ? (
            <div className="dataset-placeholder">Набор примеров пока пуст.</div>
          ) : (
            <ul className="sample-list">
              {samples.map((sample) => (
                <li key={sample.id} className="sample-item">
                  <div className="sample-meta">
                    <strong>Пример #{sample.id}</strong>
                    <span>{sample.label}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
        <ProtocolPanel
          lines={[
            'Соберите выборку по симптомам и классам диагноза.',
            'Обучите модель с one-hot целевым выходом.',
            'Определяйте диагноз по максимальной активации.',
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
              <input type="number" defaultValue={50} />
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
              aria-label="Структура сети нескольких диагнозов"
            >
              <defs>
                <marker
                  id="medicalMultiArrow"
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
              <text x="164" y="16" fontSize="12" fill="#334155">
                Скрытый ({shownHiddenNeurons})
              </text>
              <text x="336" y="16" fontSize="12" fill="#334155">
                Выход (3)
              </text>

              {inputYs.map((inputY, inputIdx) =>
                hiddenYs.map((hiddenY, hiddenIdx) => {
                  const isActive = selected[inputIdx]
                  return (
                    <line
                      key={`in-hid-${inputIdx}-${hiddenIdx}`}
                      x1="44"
                      y1={inputY}
                      x2="198"
                      y2={hiddenY}
                      stroke={isActive ? '#60a5fa' : '#d1d5db'}
                      strokeWidth={isActive ? 1.4 : 1}
                      markerEnd="url(#medicalMultiArrow)"
                      opacity={isActive ? 0.95 : 0.6}
                    />
                  )
                }),
              )}

              {hiddenYs.map((hiddenY, hiddenIdx) =>
                outputYs.map((outputY, outIdx) => (
                  <line
                    key={`hid-out-${hiddenIdx}-${outIdx}`}
                    x1="222"
                    y1={hiddenY}
                    x2="350"
                    y2={outputY}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    markerEnd="url(#medicalMultiArrow)"
                  />
                )),
              )}

              {inputYs.map((inputY, inputIdx) => {
                const isActive = selected[inputIdx]
                return (
                  <circle
                    key={`in-${inputIdx}`}
                    cx="36"
                    cy={inputY}
                    r="7"
                    fill={isActive ? '#bfdbfe' : '#e2e8f0'}
                    stroke={isActive ? '#2563eb' : '#94a3b8'}
                  />
                )
              })}

              {hiddenYs.map((hiddenY, hiddenIdx) => (
                <circle
                  key={`hid-${hiddenIdx}`}
                  cx="210"
                  cy={hiddenY}
                  r="8"
                  fill="#dcfce7"
                  stroke="#4ade80"
                />
              ))}

              {DIAGNOSES.map((diagnosisName, idx) => (
                <g key={diagnosisName}>
                  <circle
                    cx="364"
                    cy={outputYs[idx]}
                    r="10"
                    fill={label === diagnosisName ? '#fde68a' : '#ede9fe'}
                    stroke={label === diagnosisName ? '#f59e0b' : '#8b5cf6'}
                  />
                  <text x="380" y={outputYs[idx] + 4} fontSize="10" fill="#334155">
                    {diagnosisName}
                  </text>
                </g>
              ))}
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
            Рассчитать
          </button>
          <button type="button" className="ghost" onClick={clearInput}>
            Очистить вход
          </button>
          <span className="result-chip">Диагноз: {diagnosis ?? 'не рассчитан'}</span>
        </div>
      </article>
    </section>
  )
}
