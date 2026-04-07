import type { TelemetryRow } from '../types'

export type AnomalyWindow = {
  /** Время точки аномалии (сек), по оси X */
  centerTime: number
  minTime: number
  maxTime: number
}

/**
 * Ищет индекс критической аномалии питания по правилам ТЗ (без захардкоженного времени).
 * Условия: резкий провал напряжения; скорость не «падает» вместе с питанием; заряд снижается плавно;
 * высота не показывает резкого падения. Ложные скачки отсекаются совокупностью признаков.
 */
export function findAnomalyIndex(sortedRows: TelemetryRow[]): number | null {
  if (sortedRows.length < 3) return null

  let bestIdx = -1
  let bestScore = -1

  for (let i = 1; i < sortedRows.length; i++) {
    const prev = sortedRows[i - 1]
    const cur = sortedRows[i]

    const dv = prev.voltage - cur.voltage
    if (dv <= 0) continue

    const rel = dv / Math.max(0.01, prev.voltage)
    if (rel < 0.045 || dv < 0.32) continue

    const ds = cur.speed - prev.speed
    if (ds < -1.15) continue

    const dbatt = prev.battery - cur.battery
    if (dbatt <= 0 || dbatt > 2.8) continue

    const dh = cur.height - prev.height
    if (dh < -6) continue

    const score = dv * rel * (1 + Math.max(0, ds) * 0.08)

    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  return bestIdx >= 0 ? bestIdx : null
}

export function getAnomalyWindow(
  sortedRows: TelemetryRow[],
  toleranceSec = 1,
): AnomalyWindow | null {
  const idx = findAnomalyIndex(sortedRows)
  if (idx == null) return null
  const t = sortedRows[idx].time
  return {
    centerTime: t,
    minTime: t - toleranceSec,
    maxTime: t + toleranceSec,
  }
}

/** Проверка клика: ближайшая точка попадает в окно ±toleranceSec от аномалии. */
export function isClickInAnomalyWindow(
  sortedRows: TelemetryRow[],
  clickedTime: number,
  toleranceSec = 1,
): boolean {
  const w = getAnomalyWindow(sortedRows, toleranceSec)
  if (!w) return false
  return clickedTime >= w.minTime && clickedTime <= w.maxTime
}
