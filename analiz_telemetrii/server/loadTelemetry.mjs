import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function parseTelemetryCsvString(text) {
  const cleaned = text.replace(/^\uFEFF/, '')
  const result = Papa.parse(cleaned, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })
  const rows = []
  for (const raw of result.data) {
    const r = raw
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
      continue
    }
    rows.push({ time, height, speed, battery, voltage, lat, lon })
  }
  rows.sort((a, b) => a.time - b.time)
  return rows
}

export function resolveTelemetryPath() {
  if (process.env.TELEMETRY_PATH) {
    return path.resolve(process.env.TELEMETRY_PATH)
  }
  const pubPath = path.join(root, 'public', 'data', 'telemetry.csv')
  const distPath = path.join(root, 'dist', 'data', 'telemetry.csv')
  // Сначала public — актуальный источник при разработке; на проде часто есть только dist.
  if (existsSync(pubPath)) return pubPath
  if (existsSync(distPath)) return distPath
  return pubPath
}

export function loadCanonicalTelemetryRows() {
  const p = resolveTelemetryPath()
  const text = readFileSync(p, 'utf8')
  return parseTelemetryCsvString(text)
}
