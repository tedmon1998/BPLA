import { useEffect, useMemo, useState } from 'react'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'

interface LogicNetworkPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function LogicNetworkPage({ onProgressChange }: LogicNetworkPageProps) {
  type LogicFn = 'AND' | 'OR' | 'XOR'
  const samples = useMemo(
    () => [
      { x1: 0, x2: 0 },
      { x1: 0, x2: 1 },
      { x1: 1, x2: 0 },
      { x1: 1, x2: 1 },
    ],
    [],
  )
  const targetsByFn: Record<LogicFn, number[]> = {
    AND: [0, 0, 0, 1],
    OR: [0, 1, 1, 1],
    XOR: [0, 1, 1, 0],
  }

  const [logicFn, setLogicFn] = useState<LogicFn>('AND')
  const [hiddenNeurons, setHiddenNeurons] = useState(2)
  const [learningRate, setLearningRate] = useState(0.2)
  const [epochs, setEpochs] = useState(800)
  const [outputs, setOutputs] = useState<number[]>([0, 0, 0, 0])
  const [isSuccess, setIsSuccess] = useState(false)
  const [message, setMessage] = useState('Настройте параметры и запустите обучение.')

  useEffect(() => {
    onProgressChange?.(isSuccess)
  }, [isSuccess, onProgressChange])

  const train = () => {
    const hidden = Math.max(1, Math.min(6, hiddenNeurons))
    const lr = Math.max(0.001, learningRate)
    const maxEpochs = Math.max(10, epochs)

    const w1 = Array.from({ length: hidden }, () => Math.random() * 0.8 - 0.4)
    const w2 = Array.from({ length: hidden }, () => Math.random() * 0.8 - 0.4)
    const bh = Array.from({ length: hidden }, () => 0)
    const wo = Array.from({ length: hidden }, () => Math.random() * 0.8 - 0.4)
    let bo = 0
    const targets = targetsByFn[logicFn]

    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
    const dsigmoid = (y: number) => y * (1 - y)

    for (let epoch = 0; epoch < maxEpochs; epoch += 1) {
      for (let i = 0; i < samples.length; i += 1) {
        const { x1, x2 } = samples[i]
        const target = targets[i]

        const h = Array.from({ length: hidden }, (_, j) =>
          sigmoid(x1 * w1[j] + x2 * w2[j] + bh[j]),
        )
        const y = sigmoid(h.reduce((sum, hv, j) => sum + hv * wo[j], bo))

        const outDelta = (target - y) * dsigmoid(y)
        for (let j = 0; j < hidden; j += 1) {
          const hiddenDelta = outDelta * wo[j] * dsigmoid(h[j])
          wo[j] += lr * outDelta * h[j]
          w1[j] += lr * hiddenDelta * x1
          w2[j] += lr * hiddenDelta * x2
          bh[j] += lr * hiddenDelta
        }
        bo += lr * outDelta
      }
    }

    const trainedOutputs = samples.map(({ x1, x2 }) => {
      const h = Array.from({ length: hidden }, (_, j) => sigmoid(x1 * w1[j] + x2 * w2[j] + bh[j]))
      return sigmoid(h.reduce((sum, hv, j) => sum + hv * wo[j], bo))
    })

    setOutputs(trainedOutputs)
    const rounded = trainedOutputs.map((value) => (value >= 0.5 ? 1 : 0))
    const solved = rounded.every((value, index) => value === targets[index])
    setIsSuccess(solved)
    setMessage(
      solved
        ? 'Сеть успешно смоделировала функцию. Переход открыт.'
        : 'Сеть пока не смоделировала функцию. Измените параметры и повторите.',
    )
  }

  const targetValues = targetsByFn[logicFn]

  return (
    <section className="lab-page">
      <PageHero
        title="Логическая функция нейросети"
        task="Подобрать параметры нейросети для моделирования логической функции."
      />

      <section className="lab-grid lab-grid-3">
        <article className="panel">
          <h3>Таблица истинности</h3>
          <table>
            <thead>
              <tr>
                <th>X1</th>
                <th>X2</th>
                <th>d</th>
                <th>y</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>0</td>
                <td>0</td>
                <td>{targetsByFn[logicFn][0]}</td>
                <td>{outputs[0].toFixed(2)}</td>
              </tr>
              <tr>
                <td>0</td>
                <td>1</td>
                <td>{targetsByFn[logicFn][1]}</td>
                <td>{outputs[1].toFixed(2)}</td>
              </tr>
              <tr>
                <td>1</td>
                <td>0</td>
                <td>{targetsByFn[logicFn][2]}</td>
                <td>{outputs[2].toFixed(2)}</td>
              </tr>
              <tr>
                <td>1</td>
                <td>1</td>
                <td>{targetsByFn[logicFn][3]}</td>
                <td>{outputs[3].toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="panel">
          <h3>Параметры обучения</h3>
          <div className="form-col">
            <label>
              Логическая функция
              <select value={logicFn} onChange={(e) => setLogicFn(e.target.value as LogicFn)}>
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="XOR">XOR</option>
              </select>
            </label>
            <label>
              Нейронов в скрытом слое
              <input
                type="number"
                min={1}
                max={6}
                value={hiddenNeurons}
                onChange={(e) => setHiddenNeurons(Number(e.target.value))}
              />
            </label>
            <label>
              Скорость обучения
              <input
                type="number"
                step="0.01"
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
              />
            </label>
            <label>
              Эпохи
              <input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
              />
            </label>
            <button type="button" onClick={train}>
              Обучить сеть
            </button>
          </div>
        </article>

        <ProtocolPanel
          lines={[
            'Выберите функцию и параметры обучения.',
            'Запустите обучение сети с одним скрытым слоем.',
            'Сравните значения выхода с эталонной таблицей.',
            'Переход открыт только когда все 4 выхода совпадают с d.',
            message,
          ]}
        />
      </section>

      <section className="lab-grid lab-grid-2">
        <article className="panel">
          <h3>Структура сети</h3>
          <div className="viz-frame">
            <svg
              viewBox="0 0 420 170"
              className="network-svg"
              role="img"
              aria-label="Схема нейросети"
            >
              <defs>
                <marker
                  id="networkArrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                </marker>
              </defs>

              <text x="20" y="20" fontSize="12" fill="#334155">
                Вход
              </text>
              <text x="164" y="20" fontSize="12" fill="#334155">
                Скрытый слой ({hiddenNeurons})
              </text>
              <text x="352" y="20" fontSize="12" fill="#334155">
                Выход
              </text>

              <circle cx="36" cy="56" r="12" fill="#dbeafe" stroke="#60a5fa" />
              <circle cx="36" cy="112" r="12" fill="#dbeafe" stroke="#60a5fa" />
              <text x="27" y="60" fontSize="11" fill="#1d4ed8">
                X1
              </text>
              <text x="27" y="116" fontSize="11" fill="#1d4ed8">
                X2
              </text>

              {Array.from({ length: Math.max(1, Math.min(hiddenNeurons, 6)) }).map(
                (_, idx, arr) => {
                  const y = 32 + (idx * 110) / Math.max(arr.length - 1, 1)
                  return (
                    <g key={idx}>
                      <circle cx="210" cy={y} r="10" fill="#dcfce7" stroke="#4ade80" />
                      <line
                        x1="48"
                        y1="56"
                        x2="198"
                        y2={y}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        markerEnd="url(#networkArrow)"
                      />
                      <line
                        x1="48"
                        y1="112"
                        x2="198"
                        y2={y}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        markerEnd="url(#networkArrow)"
                      />
                      <line
                        x1="220"
                        y1={y}
                        x2="356"
                        y2="84"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        markerEnd="url(#networkArrow)"
                      />
                    </g>
                  )
                },
              )}

              <circle cx="372" cy="84" r="13" fill="#fef3c7" stroke="#f59e0b" />
              <text x="367" y="88" fontSize="11" fill="#b45309">
                y
              </text>
            </svg>
          </div>
        </article>
        <article className="panel">
          <h3>График выхода сети</h3>
          <div className="viz-frame">
            <svg
              viewBox="0 0 260 170"
              className="network-chart-svg"
              role="img"
              aria-label="График выходов сети"
            >
              <line x1="24" y1="142" x2="244" y2="142" stroke="#0f172a" />
              <line x1="24" y1="18" x2="24" y2="142" stroke="#0f172a" />
              <text x="4" y="20" fontSize="11" fill="#334155">
                y
              </text>
              <text x="236" y="158" fontSize="11" fill="#334155">
                #входа
              </text>

              {outputs.map((value, index) => {
                const x = 56 + index * 48
                const yPred = 142 - value * 116
                const yTarget = 142 - targetValues[index] * 116
                return (
                  <g key={index}>
                    <line x1={x} y1="142" x2={x} y2={yPred} stroke="#60a5fa" strokeWidth="8" />
                    <circle cx={x + 12} cy={yTarget} r="5" fill="#ef4444" />
                    <text x={x - 5} y="158" fontSize="10" fill="#334155">
                      {index + 1}
                    </text>
                  </g>
                )
              })}

              <rect x="132" y="8" width="10" height="10" fill="#60a5fa" />
              <text x="146" y="17" fontSize="10" fill="#334155">
                y (сеть)
              </text>
              <circle cx="198" cy="13" r="5" fill="#ef4444" />
              <text x="208" y="17" fontSize="10" fill="#334155">
                d (эталон)
              </text>
            </svg>
          </div>
        </article>
      </section>
    </section>
  )
}
