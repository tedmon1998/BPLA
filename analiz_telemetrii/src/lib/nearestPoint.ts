import type { TelemetryRow } from '../types'

/**
 * Ближайшая по времени точка данных (для обработки клика по графику).
 */
export function nearestRowByTime(rows: TelemetryRow[], timeSec: number): TelemetryRow {
  if (rows.length === 0) throw new Error('empty rows')
  let best = rows[0]
  let bestD = Math.abs(rows[0].time - timeSec)
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i].time - timeSec)
    if (d < bestD) {
      bestD = d
      best = rows[i]
    }
  }
  return best
}
