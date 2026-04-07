import { describe, expect, it } from 'vitest'
import {
  evaluateLogicFunction,
  findAlternativeSolution,
  thresholdActivation,
} from './logicNeuron'

describe('logic neuron domain', () => {
  it('calculates threshold activation', () => {
    expect(thresholdActivation(1, 1)).toBe(1)
    expect(thresholdActivation(0.99, 1)).toBe(0)
  })

  it('solves AND with known parameters', () => {
    const result = evaluateLogicFunction('AND', { w1: 1, w2: 1, theta: 1.5 })
    expect(result.isSolved).toBe(true)
  })

  it('reports XOR as not linearly separable', () => {
    const result = evaluateLogicFunction('XOR', { w1: 1, w2: 1, theta: 1 })
    expect(result.isLinearlySeparable).toBe(false)
    expect(result.protocol.join(' ')).toContain('не может')
  })

  it('finds alternative solution for AND', () => {
    const alt = findAlternativeSolution('AND', { w1: 1, w2: 1, theta: 1.5 })
    expect(alt).not.toBeNull()
  })
})
