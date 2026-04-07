/**
 * Должен совпадать по логике с src/lib/findAnomaly.ts (серверная проверка по тем же данным).
 */
export function findAnomalyIndex(sortedRows) {
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

export function getAnomalyWindow(sortedRows, toleranceSec = 1) {
  const idx = findAnomalyIndex(sortedRows)
  if (idx == null) return null
  const t = sortedRows[idx].time
  return {
    centerTime: t,
    minTime: t - toleranceSec,
    maxTime: t + toleranceSec,
  }
}
