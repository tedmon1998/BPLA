import { useEffect, useMemo, useState } from 'react'
import {
  evaluateLogicFunction,
  findAlternativeSolution,
} from '../domain/logic-neuron/logicNeuron'
import { PageHero } from '../shared/ui/PageHero'
import { ProtocolPanel } from '../shared/ui/ProtocolPanel'
import type {
  LogicFunctionId,
  LogicNeuronParams,
} from '../domain/logic-neuron/types'

const DEFAULT_PARAMS: LogicNeuronParams = {
  w1: 0,
  w2: 0,
  theta: 1,
}

const AVAILABLE_FUNCTIONS: LogicFunctionId[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR']

function normalizeToPlot(value: number): number {
  const clamped = Math.max(-0.5, Math.min(1.5, value))
  return 20 + ((1.5 - clamped) / 2) * 160
}

interface LogicNeuronPageProps {
  onProgressChange?: (isComplete: boolean) => void
}

export function LogicNeuronPage({ onProgressChange }: LogicNeuronPageProps) {
  const [fn, setFn] = useState<LogicFunctionId>('AND')
  const [params, setParams] = useState<LogicNeuronParams>(DEFAULT_PARAMS)
  const [hasUserInteraction, setHasUserInteraction] = useState(false)

  const result = useMemo(() => evaluateLogicFunction(fn, params), [fn, params])

  const altParams = useMemo(() => {
    if (fn === 'XOR' || !result.isSolved) {
      return null
    }
    return findAlternativeSolution(fn, params)
  }, [fn, params, result.isSolved])

  const decisionLine = useMemo(() => {
    if (Math.abs(params.w2) < 0.0001) {
      if (Math.abs(params.w1) < 0.0001) {
        return null
      }

      const x = params.theta / params.w1
      return {
        x1: x,
        y1: -0.5,
        x2: x,
        y2: 1.5,
      }
    }

    const xLeft = -0.5
    const xRight = 1.5
    const yLeft = (params.theta - params.w1 * xLeft) / params.w2
    const yRight = (params.theta - params.w1 * xRight) / params.w2
    return { x1: xLeft, y1: yLeft, x2: xRight, y2: yRight }
  }, [params.theta, params.w1, params.w2])

  const isLevelCompleted =
    hasUserInteraction && fn !== 'XOR' && result.isSolved && altParams !== null

  useEffect(() => {
    onProgressChange?.(isLevelCompleted)
  }, [isLevelCompleted, onProgressChange])

  return (
    <section className="lab-page">
      <PageHero
        title="Логические функции нейрона"
        task="Подберите два различных набора W1, W2 и θ для моделирования функции."
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
              {result.rows.map((row, index) => (
                <tr key={`${row.x1}-${row.x2}-${index}`}>
                  <td>{row.x1}</td>
                  <td>{row.x2}</td>
                  <td>{row.d}</td>
                  <td className={row.isCorrect ? 'ok' : 'bad'}>{row.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <h3>Параметры нейрона</h3>
          <div className="form-col">
            <label>
              Функция
              <select
                id="logic-fn"
                value={fn}
                onChange={(event) => {
                  setHasUserInteraction(true)
                  setFn(event.target.value as LogicFunctionId)
                }}
              >
                {AVAILABLE_FUNCTIONS.map((logicFn) => (
                  <option key={logicFn} value={logicFn}>
                    {logicFn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              W1
              <input
                type="number"
                step="0.1"
                value={params.w1}
                onChange={(event) => {
                  setHasUserInteraction(true)
                  setParams((prev) => ({ ...prev, w1: Number(event.target.value) }))
                }}
              />
            </label>
            <label>
              W2
              <input
                type="number"
                step="0.1"
                value={params.w2}
                onChange={(event) => {
                  setHasUserInteraction(true)
                  setParams((prev) => ({ ...prev, w2: Number(event.target.value) }))
                }}
              />
            </label>
            <label>
              θ
              <input
                type="number"
                step="0.1"
                value={params.theta}
                onChange={(event) => {
                  setHasUserInteraction(true)
                  setParams((prev) => ({ ...prev, theta: Number(event.target.value) }))
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setHasUserInteraction(true)
                setParams(DEFAULT_PARAMS)
              }}
            >
              Сброс параметров
            </button>
          </div>
        </article>

        <ProtocolPanel
          lines={[
            ...result.protocol,
            altParams
              ? `Альтернативный набор: W1=${altParams.w1}, W2=${altParams.w2}, θ=${altParams.theta}`
              : 'Альтернативный набор пока не найден.',
            isLevelCompleted
              ? 'Уровень пройден: найдено корректное решение и альтернативный набор.'
              : 'Уровень не пройден: подберите корректные параметры и альтернативный набор.',
            'Переход дальше откроется только после выполнения задания на этом уровне.',
          ]}
        />
      </section>

      <section className="lab-grid lab-grid-2">
        <article className="panel">
          <h3>Схема нейрона</h3>
          <div className="viz-frame">
            <svg
              className="neuron-svg"
              viewBox="0 0 420 180"
              role="img"
              aria-label="Схема порогового нейрона"
            >
              <defs>
                <marker
                  id="arrowHead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
                </marker>
              </defs>

              <circle cx="250" cy="90" r="36" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
              <text x="242" y="95" fontSize="20" fill="#1e40af">
                Σ
              </text>
              <text x="288" y="95" fontSize="18" fill="#0f172a">
                ≥ θ
              </text>
              <text x="344" y="95" fontSize="18" fill="#b45309">
                y
              </text>

              <line x1="36" y1="55" x2="214" y2="78" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrowHead)" />
              <line x1="36" y1="125" x2="214" y2="102" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrowHead)" />
              <line x1="286" y1="90" x2="334" y2="90" stroke="#f59e0b" strokeWidth="2.5" markerEnd="url(#arrowHead)" />

              <text x="20" y="58" fontSize="18" fill="#1e3a8a">
                X1
              </text>
              <text x="20" y="129" fontSize="18" fill="#1e3a8a">
                X2
              </text>
              <text x="110" y="64" fontSize="16" fill="#1d4ed8">
                W1={params.w1.toFixed(1)}
              </text>
              <text x="110" y="118" fontSize="16" fill="#1d4ed8">
                W2={params.w2.toFixed(1)}
              </text>
              <text x="220" y="145" fontSize="16" fill="#334155">
                θ={params.theta.toFixed(1)}
              </text>
            </svg>
          </div>
        </article>
        <article className="panel">
          <h3>Геометрические интерпретации</h3>
          <div className="viz-frame">
            <svg
              className="geo-svg"
              viewBox="0 0 220 220"
              role="img"
              aria-label="2D геометрическая интерпретация"
            >
              <rect x="20" y="20" width="160" height="160" fill="#f8fafc" stroke="#94a3b8" />
              <line x1="20" y1="180" x2="180" y2="180" stroke="#0f172a" />
              <line x1="20" y1="20" x2="20" y2="180" stroke="#0f172a" />
              <text x="184" y="184" fontSize="12" fill="#0f172a">
                X1
              </text>
              <text x="6" y="16" fontSize="12" fill="#0f172a">
                X2
              </text>

              <circle cx={normalizeToPlot(0)} cy={normalizeToPlot(0)} r="5" fill="#22c55e" />
              <circle cx={normalizeToPlot(0)} cy={normalizeToPlot(1)} r="5" fill="#22c55e" />
              <circle cx={normalizeToPlot(1)} cy={normalizeToPlot(0)} r="5" fill="#22c55e" />
              <circle cx={normalizeToPlot(1)} cy={normalizeToPlot(1)} r="5" fill="#22c55e" />

              {decisionLine ? (
                <line
                  x1={normalizeToPlot(decisionLine.x1)}
                  y1={normalizeToPlot(decisionLine.y1)}
                  x2={normalizeToPlot(decisionLine.x2)}
                  y2={normalizeToPlot(decisionLine.y2)}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                />
              ) : null}
            </svg>
          </div>
        </article>
      </section>
    </section>
  )
}
