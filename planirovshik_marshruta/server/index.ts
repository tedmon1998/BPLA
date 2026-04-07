import cors from 'cors'
import express from 'express'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { missionKey } from '../shared/terrain.ts'
import { parseFlightMode, parseRouteCoordinates, validateRoute } from './validateRoute.ts'

const app = express()
const port = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json({ limit: '64kb' }))

const attemptsByIp = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const ACTIVATION_WINDOW_MS = 20 * 60 * 1000
const activationSessions = new Map<string, number>()

const ACTIVATION_CODE_HASH_HEX = '0b3664250308a68fa13cd9f139334b8cbc063c3f8691eb5e25ad1157a881bc17'

function hashActivationCode(code: string): Buffer {
  return createHash('sha256').update(code).digest()
}

function verifyActivationCode(code: string): boolean {
  const candidate = hashActivationCode(code.trim())
  const expected = Buffer.from(ACTIVATION_CODE_HASH_HEX, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const state = attemptsByIp.get(ip)
  if (!state || now >= state.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (state.count >= RATE_LIMIT_MAX) {
    return true
  }
  state.count += 1
  return false
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/activate', (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : ''
  if (!verifyActivationCode(code)) {
    res.status(401).json({ ok: false, message: 'Неверный код активации.' })
    return
  }

  const token = randomUUID()
  const expiresAt = Date.now() + ACTIVATION_WINDOW_MS
  activationSessions.set(token, expiresAt)
  res.status(200).json({ ok: true, token, expiresAt })
})

app.post('/api/end-attempt', (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  if (token) {
    activationSessions.delete(token)
  }
  res.status(200).json({ ok: true })
})

app.post('/api/validate-route', (req, res) => {
  const ip = req.ip ?? 'unknown'
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, message: 'Слишком много попыток. Повторите позже.' })
    return
  }

  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  const expiresAt = token ? activationSessions.get(token) : undefined
  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) {
      activationSessions.delete(token)
    }
    res.status(401).json({ ok: false, message: 'Сессия активации истекла. Введите код снова.' })
    return
  }

  const route = parseRouteCoordinates(req.body)
  if (!route) {
    res.status(400).json({ ok: false, message: 'Некорректный формат маршрута.' })
    return
  }

  const mode = parseFlightMode(req.body)
  const result = validateRoute(route, mode)
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.reason })
    return
  }

  res.status(200).json({
    ok: true,
    message: `Маршрут подтвержден. Длина: ${result.distanceKm.toFixed(3)} км.`,
    key: missionKey,
  })
})

app.listen(port, () => {
  console.log(`Secure mission API is running on http://localhost:${port}`)
})
