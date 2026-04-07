import { describe, expect, it } from 'vitest'
import {
  predictBinary,
  predictMultiClass,
  trainBinaryPerceptron,
  trainMultiClassPerceptron,
} from './perceptron'

describe('perceptron domain', () => {
  it('learns OR in binary mode', () => {
    const samples = [
      { features: [0, 0], label: 0 as const },
      { features: [0, 1], label: 1 as const },
      { features: [1, 0], label: 1 as const },
      { features: [1, 1], label: 1 as const },
    ]
    const result = trainBinaryPerceptron(samples, {
      learningRate: 0.2,
      epochs: 50,
      seed: 42,
    })

    const predictions = samples.map((sample) =>
      predictBinary(sample.features, result.model),
    )
    expect(predictions).toEqual([0, 1, 1, 1])
  })

  it('learns simple three-class separation', () => {
    const labels = ['A', 'B', 'C'] as const
    const samples = [
      { features: [1, 0, 0], label: 'A' as const },
      { features: [0.9, 0.1, 0], label: 'A' as const },
      { features: [0, 1, 0], label: 'B' as const },
      { features: [0, 0.9, 0.1], label: 'B' as const },
      { features: [0, 0, 1], label: 'C' as const },
      { features: [0.1, 0, 0.9], label: 'C' as const },
    ]
    const result = trainMultiClassPerceptron(samples, labels, {
      learningRate: 0.2,
      epochs: 80,
      seed: 21,
    })

    const predicted = samples.map((sample) =>
      predictMultiClass(sample.features, result.model),
    )
    expect(predicted).toEqual(['A', 'A', 'B', 'B', 'C', 'C'])
  })
})
