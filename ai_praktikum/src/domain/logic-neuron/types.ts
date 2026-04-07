export type LogicFunctionId = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR'

export interface TruthRow {
  x1: 0 | 1
  x2: 0 | 1
  d: 0 | 1
  y: 0 | 1
  isCorrect: boolean
}

export interface LogicNeuronParams {
  w1: number
  w2: number
  theta: number
}

export interface LogicEvaluationResult {
  rows: TruthRow[]
  isSolved: boolean
  isLinearlySeparable: boolean
  protocol: string[]
}
