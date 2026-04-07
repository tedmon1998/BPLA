/**
 * Серверная логика: активация попытки + проверка ответа.
 * Секреты (ключ/код активации/страна) только в env.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getAnomalyWindow } from './findAnomaly.mjs'
import { loadCanonicalTelemetryRows } from './loadTelemetry.mjs'

const verifySessions = new Map()
const attemptSessions = new Map()
const rateByKey = new Map()

const SESSION_TTL_MS = 30 * 60 * 1000
const ATTEMPT_WINDOW_MS = 20 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const MAX_ATTEMPTS_PER_WINDOW = 18
const MIN_MS_AFTER_BOOTSTRAP = 2500

function sessionCookieSuffix() {
  const secure = process.env.COOKIE_SECURE === '1'
  return secure ? '; Secure' : ''
}

let cachedAnomalyBounds = null

function getAnomalyBoundsFromFile() {
  if (cachedAnomalyBounds !== null) return cachedAnomalyBounds
  try {
    const rows = loadCanonicalTelemetryRows()
    cachedAnomalyBounds = getAnomalyWindow(rows, 1)
  } catch (e) {
    console.error('Не удалось загрузить телеметрию для проверки:', e)
    cachedAnomalyBounds = undefined
  }
  return cachedAnomalyBounds
}

function getRewardCode() {
  return process.env.REWARD_CODE
}

function getExpectedCountryIso2() {
  const c = process.env.EXPECTED_COUNTRY_ISO2
  if (!c || typeof c !== 'string') return null
  const u = c.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (u.length !== 2) return null
  return u
}

function getActivationCodeHash() {
  const h = process.env.ACTIVATION_CODE_HASH
  if (!h || typeof h !== 'string') return null
  const v = h.trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(v) ? v : null
}

function sha256Hex(input) {
  return createHash('sha256').update(String(input), 'utf8').digest('hex')
}

function normalizeCountryIso2Input(input) {
  if (typeof input !== 'string') return null
  const u = input.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (u.length < 2) return null
  return u.slice(0, 2)
}

function cleanupSessions() {
  const now = Date.now()
  for (const [id, s] of verifySessions) {
    if (now - s.created > SESSION_TTL_MS) verifySessions.delete(id)
  }
  for (const [id, s] of attemptSessions) {
    if (s.expiresAt <= now) attemptSessions.delete(id)
  }
}

function rateLimitKey(req) {
  const xf = req.headers?.['x-forwarded-for']
  const ip =
    typeof xf === 'string'
      ? xf.split(',')[0].trim()
      : req.socket?.remoteAddress || 'unknown'
  return ip
}

function checkRate(key) {
  const now = Date.now()
  let e = rateByKey.get(key)
  if (!e || now - e.windowStart > RATE_WINDOW_MS) {
    e = { windowStart: now, count: 0 }
    rateByKey.set(key, e)
  }
  e.count += 1
  return e.count <= MAX_ATTEMPTS_PER_WINDOW
}

function safeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a), 'utf8')
    const bb = Buffer.from(String(b), 'utf8')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

function parseCookies(header) {
  const out = {}
  if (!header || typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    out[k] = decodeURIComponent(v)
  }
  return out
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 4096) {
        req.destroy()
        reject(new Error('payload too large'))
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendJson(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

function getActiveAttempt(req) {
  cleanupSessions()
  const cookies = parseCookies(req.headers?.cookie)
  const attemptId = cookies.attempt_session
  const attempt = attemptId ? attemptSessions.get(attemptId) : undefined
  if (!attempt) return null
  if (attempt.expiresAt <= Date.now()) {
    attemptSessions.delete(attemptId)
    return null
  }
  return { attemptId, attempt }
}

export function handleAttemptStatus(req, res) {
  const active = getActiveAttempt(req)
  if (!active) {
    sendJson(res, 200, { active: false, remainingSec: 0 })
    return
  }
  const remainingSec = Math.max(
    0,
    Math.ceil((active.attempt.expiresAt - Date.now()) / 1000),
  )
  sendJson(res, 200, { active: true, remainingSec })
}

export function handleActivateFromParsedBody(req, res, body) {
  cleanupSessions()
  const key = rateLimitKey(req)
  if (!checkRate(key)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }

  const expectedHash = getActivationCodeHash()
  if (!expectedHash) {
    console.error('ACTIVATION_CODE_HASH is not set or invalid')
    sendJson(res, 503, { ok: false, error: 'server_misconfigured' })
    return
  }

  const submitted = typeof body?.code === 'string' ? body.code.trim() : ''
  if (submitted.length < 4 || submitted.length > 64) {
    sendJson(res, 400, { ok: false, error: 'bad_activation_code' })
    return
  }

  const submittedHash = sha256Hex(submitted)
  if (!safeEqual(submittedHash, expectedHash)) {
    sendJson(res, 200, { ok: false, error: 'invalid_activation_code' })
    return
  }

  const attemptId = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + ATTEMPT_WINDOW_MS
  attemptSessions.set(attemptId, { created: Date.now(), expiresAt })

  const maxAge = Math.floor(ATTEMPT_WINDOW_MS / 1000)
  res.setHeader(
    'Set-Cookie',
    `attempt_session=${attemptId}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${sessionCookieSuffix()}`,
  )
  sendJson(res, 200, { ok: true, remainingSec: Math.ceil(ATTEMPT_WINDOW_MS / 1000) })
}

export async function handleActivateRaw(req, res) {
  let raw
  try {
    raw = await readBody(req)
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad_body' })
    return
  }
  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad_json' })
    return
  }
  handleActivateFromParsedBody(req, res, body)
}

export function handleActivateExpress(req, res) {
  handleActivateFromParsedBody(req, res, req.body)
}

export function handleFinishAttempt(req, res) {
  const cookies = parseCookies(req.headers?.cookie)
  const attemptId = cookies.attempt_session
  if (attemptId) attemptSessions.delete(attemptId)
  res.setHeader(
    'Set-Cookie',
    `attempt_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${sessionCookieSuffix()}`,
  )
  sendJson(res, 200, { ok: true })
}

export function handleBootstrap(req, res) {
  const active = getActiveAttempt(req)
  if (!active) {
    sendJson(res, 401, { ok: false, error: 'activation_required' })
    return
  }

  cleanupSessions()
  const sessionId = randomBytes(32).toString('hex')
  const csrfToken = randomBytes(32).toString('hex')
  verifySessions.set(sessionId, {
    csrfToken,
    created: Date.now(),
  })

  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  res.setHeader(
    'Set-Cookie',
    `flight_session=${sessionId}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${sessionCookieSuffix()}`,
  )
  const remainingSec = Math.max(
    0,
    Math.ceil((active.attempt.expiresAt - Date.now()) / 1000),
  )
  sendJson(res, 200, { csrfToken, remainingSec })
}

export function handleVerifyFromParsedBody(req, res, body) {
  cleanupSessions()

  const active = getActiveAttempt(req)
  if (!active) {
    sendJson(res, 401, { ok: false, error: 'activation_required' })
    return
  }

  const key = rateLimitKey(req)
  if (!checkRate(key)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }

  const cookies = parseCookies(req.headers?.cookie)
  const sessionId = cookies.flight_session
  const session = sessionId ? verifySessions.get(sessionId) : undefined
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'session_required' })
    return
  }

  const bounds = getAnomalyBoundsFromFile()
  if (!bounds) {
    sendJson(res, 503, { ok: false, error: 'server_misconfigured' })
    return
  }

  const code = getRewardCode()
  if (!code || typeof code !== 'string' || code.length < 4) {
    console.error('REWARD_CODE is not set or too short')
    sendJson(res, 503, { ok: false, error: 'server_misconfigured' })
    return
  }

  const expectedCountry = getExpectedCountryIso2()
  if (!expectedCountry) {
    console.error('EXPECTED_COUNTRY_ISO2 is not set or invalid')
    sendJson(res, 503, { ok: false, error: 'server_misconfigured' })
    return
  }

  const csrf = body?.csrfToken
  if (!safeEqual(csrf, session.csrfToken)) {
    sendJson(res, 403, { ok: false, error: 'invalid_token' })
    return
  }

  if (Date.now() - session.created < MIN_MS_AFTER_BOOTSTRAP) {
    sendJson(res, 400, { ok: false, error: 'too_fast' })
    return
  }

  const timeSec = body?.timeSec
  if (typeof timeSec !== 'number' || !Number.isFinite(timeSec)) {
    sendJson(res, 400, { ok: false, error: 'bad_time' })
    return
  }

  const countryGuess = normalizeCountryIso2Input(body?.countryIso2)
  if (!countryGuess) {
    sendJson(res, 400, { ok: false, error: 'bad_country' })
    return
  }

  const timeOk = timeSec >= bounds.minTime && timeSec <= bounds.maxTime
  const countryOk = safeEqual(countryGuess, expectedCountry)

  if (timeOk && countryOk) {
    verifySessions.delete(sessionId)
    res.setHeader(
      'Set-Cookie',
      `flight_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${sessionCookieSuffix()}`,
    )
    sendJson(res, 200, { ok: true, code })
    return
  }

  if (!timeOk && countryOk) {
    sendJson(res, 200, { ok: false, error: 'wrong_time' })
    return
  }
  if (timeOk && !countryOk) {
    sendJson(res, 200, { ok: false, error: 'wrong_country' })
    return
  }
  sendJson(res, 200, { ok: false, error: 'wrong_both' })
}

export async function handleVerifyRaw(req, res) {
  let raw
  try {
    raw = await readBody(req)
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad_body' })
    return
  }
  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad_json' })
    return
  }
  handleVerifyFromParsedBody(req, res, body)
}

export function handleVerifyExpress(req, res) {
  handleVerifyFromParsedBody(req, res, req.body)
}

export function createViteApiMiddleware() {
  return (req, res, next) => {
    const pathname = (req.url || '').split('?')[0]
    if (pathname === '/api/attempt/status' && req.method === 'GET') {
      handleAttemptStatus(req, res)
      return
    }
    if (pathname === '/api/attempt/activate' && req.method === 'POST') {
      handleActivateRaw(req, res).catch(() =>
        sendJson(res, 500, { ok: false, error: 'internal' }),
      )
      return
    }
    if (pathname === '/api/attempt/finish' && req.method === 'POST') {
      handleFinishAttempt(req, res)
      return
    }
    if (pathname === '/api/bootstrap' && req.method === 'GET') {
      handleBootstrap(req, res)
      return
    }
    if (pathname === '/api/verify' && req.method === 'POST') {
      handleVerifyRaw(req, res).catch(() =>
        sendJson(res, 500, { ok: false, error: 'internal' }),
      )
      return
    }
    next()
  }
}
