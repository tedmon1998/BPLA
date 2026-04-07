import { createSeededRandom } from './seededRandom'

export interface BinarySample {
  features: number[]
  label: 0 | 1
}

export interface BinaryModel {
  weights: number[]
  bias: number
}

export interface BinaryTrainingResult {
  model: BinaryModel
  errorHistory: number[]
  epochsUsed: number
}

export interface MultiClassSample<TLabel extends string> {
  features: number[]
  label: TLabel
}

export interface MultiClassModel<TLabel extends string> {
  labels: readonly TLabel[]
  weights: number[][]
  bias: number[]
}

export interface MultiClassTrainingResult<TLabel extends string> {
  model: MultiClassModel<TLabel>
  errorHistory: number[]
  epochsUsed: number
}

interface BinaryTrainingOptions {
  learningRate: number
  epochs: number
  seed: number
}

interface MultiClassTrainingOptions {
  learningRate: number
  epochs: number
  seed: number
}

export function predictBinary(features: number[], model: BinaryModel): 0 | 1 {
  let sum = model.bias
  for (let i = 0; i < features.length; i += 1) {
    sum += features[i] * model.weights[i]
  }
  return sum >= 0 ? 1 : 0
}

export function trainBinaryPerceptron(
  samples: BinarySample[],
  options: BinaryTrainingOptions,
): BinaryTrainingResult {
  const featureCount = samples[0]?.features.length ?? 0
  const random = createSeededRandom(options.seed)
  const weights = Array.from(
    { length: featureCount },
    () => (random.next() - 0.5) * 0.2,
  )
  let bias = (random.next() - 0.5) * 0.2
  const errorHistory: number[] = []

  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    let errors = 0
    for (const sample of samples) {
      const predicted = predictBinary(sample.features, { weights, bias })
      const delta = sample.label - predicted
      if (delta !== 0) {
        errors += 1
        for (let i = 0; i < featureCount; i += 1) {
          weights[i] += options.learningRate * delta * sample.features[i]
        }
        bias += options.learningRate * delta
      }
    }
    errorHistory.push(errors)
    if (errors === 0) {
      break
    }
  }

  return {
    model: { weights, bias },
    errorHistory,
    epochsUsed: errorHistory.length,
  }
}

export function predictMultiClass<TLabel extends string>(
  features: number[],
  model: MultiClassModel<TLabel>,
): TLabel {
  let bestScore = Number.NEGATIVE_INFINITY
  let bestIndex = 0

  for (let classIdx = 0; classIdx < model.labels.length; classIdx += 1) {
    let score = model.bias[classIdx]
    for (let i = 0; i < features.length; i += 1) {
      score += features[i] * model.weights[classIdx][i]
    }
    if (score > bestScore) {
      bestScore = score
      bestIndex = classIdx
    }
  }

  return model.labels[bestIndex]
}

export function trainMultiClassPerceptron<TLabel extends string>(
  samples: MultiClassSample<TLabel>[],
  labels: readonly TLabel[],
  options: MultiClassTrainingOptions,
): MultiClassTrainingResult<TLabel> {
  const featureCount = samples[0]?.features.length ?? 0
  const random = createSeededRandom(options.seed)

  const weights = labels.map(() =>
    Array.from({ length: featureCount }, () => (random.next() - 0.5) * 0.2),
  )
  const bias = labels.map(() => (random.next() - 0.5) * 0.2)
  const errorHistory: number[] = []

  for (let epoch = 0; epoch < options.epochs; epoch += 1) {
    let errors = 0
    for (const sample of samples) {
      const predicted = predictMultiClass(sample.features, { labels, weights, bias })
      const predictedIdx = labels.indexOf(predicted)
      const targetIdx = labels.indexOf(sample.label)
      if (predictedIdx !== targetIdx) {
        errors += 1
        for (let i = 0; i < featureCount; i += 1) {
          weights[targetIdx][i] += options.learningRate * sample.features[i]
          weights[predictedIdx][i] -= options.learningRate * sample.features[i]
        }
        bias[targetIdx] += options.learningRate
        bias[predictedIdx] -= options.learningRate
      }
    }
    errorHistory.push(errors)
    if (errors === 0) {
      break
    }
  }

  return {
    model: { labels, weights, bias },
    errorHistory,
    epochsUsed: errorHistory.length,
  }
}
