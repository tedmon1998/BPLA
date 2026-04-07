import type {
  LogicEvaluationResult,
  LogicFunctionId,
  LogicNeuronParams,
  TruthRow,
} from './types'

const INPUTS = [
  { x1: 0, x2: 0 },
  { x1: 0, x2: 1 },
  { x1: 1, x2: 0 },
  { x1: 1, x2: 1 },
] as const

const DESIRED: Record<LogicFunctionId, readonly (0 | 1)[]> = {
  AND: [0, 0, 0, 1],
  OR: [0, 1, 1, 1],
  NAND: [1, 1, 1, 0],
  NOR: [1, 0, 0, 0],
  XOR: [0, 1, 1, 0],
}

const LINEARLY_SEPARABLE: Record<LogicFunctionId, boolean> = {
  AND: true,
  OR: true,
  NAND: true,
  NOR: true,
  XOR: false,
}

export function thresholdActivation(sum: number, theta: number): 0 | 1 {
  return sum >= theta ? 1 : 0
}

export function evaluateLogicFunction(
  fn: LogicFunctionId,
  params: LogicNeuronParams,
): LogicEvaluationResult {
  const desired = DESIRED[fn]
  const rows: TruthRow[] = INPUTS.map(({ x1, x2 }, index) => {
    const sum = x1 * params.w1 + x2 * params.w2
    const y = thresholdActivation(sum, params.theta)
    const d = desired[index]
    return { x1, x2, d, y, isCorrect: d === y }
  })

  const correctCount = rows.filter((row) => row.isCorrect).length
  const isSolved = correctCount === rows.length
  const isLinearlySeparable = LINEARLY_SEPARABLE[fn]
  const protocol: string[] = [
    `Функция: ${fn}`,
    `Параметры: W1=${params.w1.toFixed(2)}, W2=${params.w2.toFixed(2)}, θ=${params.theta.toFixed(2)}`,
    `Совпадений: ${correctCount}/${rows.length}`,
  ]

  if (!isLinearlySeparable) {
    protocol.push(
      'XOR не является линейно разделимой: одиночный пороговый нейрон не может смоделировать ее полностью.',
    )
  } else if (isSolved) {
    protocol.push('Функция смоделирована успешно.')
  } else {
    protocol.push('Функция пока не смоделирована, попробуйте другой набор параметров.')
  }

  return { rows, isSolved, isLinearlySeparable, protocol }
}

export function findAlternativeSolution(
  fn: Exclude<LogicFunctionId, 'XOR'>,
  primary: LogicNeuronParams,
): LogicNeuronParams | null {
  for (let w1 = -2; w1 <= 2; w1 += 0.5) {
    for (let w2 = -2; w2 <= 2; w2 += 0.5) {
      for (let theta = -2; theta <= 2; theta += 0.5) {
        const candidate = { w1, w2, theta }
        const isSame =
          Math.abs(candidate.w1 - primary.w1) < 0.001 &&
          Math.abs(candidate.w2 - primary.w2) < 0.001 &&
          Math.abs(candidate.theta - primary.theta) < 0.001

        if (isSame) {
          continue
        }

        const result = evaluateLogicFunction(fn, candidate)
        if (result.isSolved) {
          return candidate
        }
      }
    }
  }

  return null
}
