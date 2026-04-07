export type HyperParams = {
  learningRate: number
  epochs: number
  batchSize: number
}

export type LossPoint = {
  epoch: number
  targetLoss: number
  userLoss?: number
}

const EPOCH_POINTS = 60

export function simulateLossCurve(params: HyperParams, points = EPOCH_POINTS): number[] {
  const lr = params.learningRate
  const epochs = params.epochs
  const batch = params.batchSize

  const lrQuality = 1 / (1 + Math.abs(Math.log10(lr) - Math.log10(0.015)) * 1.35)
  const epochQuality = Math.min(1.5, epochs / 42)
  const batchPenalty = 1 + Math.abs(Math.log2(batch / 32)) * 0.08
  const decay = Math.max(0.85, 1.75 + lrQuality * 1.25) / batchPenalty
  const floor = Math.max(0.01, 0.22 / (1 + epochQuality * 0.9))
  const start = 1.45 + (1 - lrQuality) * 0.35 + batchPenalty * 0.08

  const curve: number[] = []
  for (let i = 1; i <= points; i += 1) {
    const t = i / points
    const shape = 0.03 * Math.sin(t * 9 + batch / 10)
    const value = floor + start * Math.exp(-decay * t) + shape * (1 - t)
    curve.push(Number(Math.max(0.01, value).toFixed(4)))
  }

  return curve
}

export function buildTargetCurveFromParams(
  params: HyperParams,
  points = EPOCH_POINTS,
): LossPoint[] {
  const values = simulateLossCurve(params, points)
  const result: LossPoint[] = []

  for (let i = 1; i <= points; i += 1) {
    result.push({ epoch: i, targetLoss: values[i - 1] })
  }

  return result
}

export function buildUserCurve(
  params: HyperParams,
  target: LossPoint[],
): LossPoint[] {
  const userValues = simulateLossCurve(params, target.length)

  return target.map((point, index) => {
    return {
      ...point,
      userLoss: userValues[index],
    }
  })
}

function trapezoidArea(x0: number, y0: number, x1: number, y1: number): number {
  return ((y0 + y1) * (x1 - x0)) / 2
}

export function areaUnderCurve(
  points: Array<{ epoch: number; value: number }>,
): number {
  let area = 0
  for (let i = 1; i < points.length; i += 1) {
    area += trapezoidArea(
      points[i - 1].epoch,
      points[i - 1].value,
      points[i].epoch,
      points[i].value,
    )
  }
  return area
}

export function areaDiffPercent(curve: LossPoint[]): number {
  const targetArea = areaUnderCurve(
    curve.map((p) => ({ epoch: p.epoch, value: p.targetLoss })),
  )
  const userArea = areaUnderCurve(
    curve.map((p) => ({ epoch: p.epoch, value: p.userLoss ?? p.targetLoss })),
  )

  return Math.abs((userArea - targetArea) / targetArea) * 100
}

export function evaluateAttemptWithTarget(
  params: HyperParams,
  targetParams: HyperParams,
): {
  curve: LossPoint[]
  diffPercent: number
  unlocked: boolean
} {
  const target = buildTargetCurveFromParams(targetParams)
  const curve = buildUserCurve(params, target)
  const diffPercent = areaDiffPercent(curve)

  return {
    curve,
    diffPercent,
    unlocked: diffPercent < 1,
  }
}

export function evaluateAttempt(params: HyperParams) {
  return evaluateAttemptWithTarget(params, {
    learningRate: 0.015,
    epochs: 42,
    batchSize: 32,
  })
}
