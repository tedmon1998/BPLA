import Papa from 'papaparse'
import type { TelemetryRow } from './types'

const REQUIRED = ['time', 'height', 'speed', 'battery', 'voltage', 'lat', 'lon'] as const

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '')
}

function rowToTelemetry(r: Record<string, unknown>): TelemetryRow | null {
  const time = Number(r.time)
  const height = Number(r.height)
  const speed = Number(r.speed)
  const battery = Number(r.battery)
  const voltage = Number(r.voltage)
  const lat = Number(r.lat)
  const lon = Number(r.lon)
  if (
    [time, height, speed, battery, voltage, lat, lon].some(
      (v) => typeof v !== 'number' || !Number.isFinite(v),
    )
  ) {
    return null
  }
  return { time, height, speed, battery, voltage, lat, lon }
}

/**
 * Парсинг CSV-текста в массив точек (papaparse).
 */
export function parseTelemetryCsvString(text: string): TelemetryRow[] {
  const cleaned = text.replace(/^\uFEFF/, '')
  const result = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  if (result.errors.length > 0) {
    const msg = result.errors.map((e) => e.message).join('; ')
    throw new Error(`Ошибка CSV: ${msg}`)
  }

  const fields = result.meta.fields?.map(normalizeHeader) ?? []
  for (const col of REQUIRED) {
    if (!fields.includes(col)) {
      throw new Error(`В CSV нет колонки «${col}». Ожидаются: ${REQUIRED.join(', ')}`)
    }
  }

  const rows: TelemetryRow[] = []
  for (const raw of result.data) {
    const t = rowToTelemetry(raw as Record<string, unknown>)
    if (t) rows.push(t)
  }

  rows.sort((a, b) => a.time - b.time)
  return rows
}

/**
 * Статический CSV из `public/data/` (после сборки — в корне сайта). Отдельно ничего подгружать не нужно.
 */
export function loadDefaultTelemetryCsv(): Promise<string> {
  return fetch('/data/telemetry.csv', { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  })
}
