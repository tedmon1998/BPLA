'use strict'

const crypto = require('node:crypto')
const { buildTargetCurveFromParams, evaluateAttemptWithTarget } = require('./simulator.cjs')
const { QUESTION_POOL } = require('./questionPool.cjs')

const SESSION_COOKIE = 'ml_session'
const MODEL_KEY = 'MODEL-CONV'
const QUIZ_TIMEOUT_MS = 15000
const ACTIVATION_WINDOW_MS = 20 * 60 * 1000
const ACTIVATION_CODE_HASH =
  '52e2ec99cfd728bbbb1dc56700b70e877fb1a115a0a93c354d0822a1a8a4ce6c'

const sessionStore = new Map()

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null
  const item = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!item) return null
  return item.slice(name.length + 1)
}

function randomFloat(min, max, step) {
  const count = Math.floor((max - min) / step)
  const offset = Math.floor(Math.random() * (count + 1))
  return Number((min + offset * step).toFixed(4))
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomBatchSize() {
  const allowed = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128]
  return allowed[randomInt(0, allowed.length - 1)]
}

function createRandomParams() {
  return {
    learningRate: randomFloat(0.001, 0.1, 0.001),
    epochs: randomInt(10, 100),
    batchSize: randomBatchSize(),
  }
}

function createChallenge() {
  const targetParams = {
    learningRate: randomFloat(0.003, 0.06, 0.001),
    epochs: randomInt(24, 90),
    batchSize: randomBatchSize(),
  }
  let initialParams = createRandomParams()
  for (let i = 0; i < 50; i += 1) {
    const diff = evaluateAttemptWithTarget(initialParams, targetParams).diffPercent
    if (diff > 20) break
    initialParams = createRandomParams()
  }
  return { targetParams, initialParams }
}

function sanitizeParams(input) {
  if (
    typeof input.learningRate !== 'number' ||
    typeof input.epochs !== 'number' ||
    typeof input.batchSize !== 'number'
  ) {
    return null
  }
  if (input.learningRate < 0.001 || input.learningRate > 0.1) return null
  if (input.epochs < 10 || input.epochs > 100) return null
  if (input.batchSize < 8 || input.batchSize > 128 || input.batchSize % 8 !== 0) return null
  return {
    learningRate: Number(input.learningRate.toFixed(4)),
    epochs: Math.round(input.epochs),
    batchSize: Math.round(input.batchSize),
  }
}

function pickTwoQuestions() {
  const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

function toPublicQuestions(questions) {
  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: [...q.options].sort(() => Math.random() - 0.5),
  }))
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function isActivated(state) {
  return typeof state.activatedUntil === 'number' && state.activatedUntil > Date.now()
}

function requireActivation(state, res) {
  if (!isActivated(state)) {
    state.activatedUntil = null
    state.quizQuestions = []
    state.quizIssuedAt = null
    sendJson(res, 401, { message: 'Activation required' })
    return false
  }
  return true
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function getOrCreateSession(req, res) {
  const cookieSession = parseCookie(req.headers.cookie, SESSION_COOKIE)
  let sessionId = cookieSession

  if (!sessionId || !sessionStore.has(sessionId)) {
    sessionId = crypto.randomUUID()
    const challenge = createChallenge()
    sessionStore.set(sessionId, {
      targetParams: challenge.targetParams,
      initialParams: challenge.initialParams,
      quizQuestions: [],
      quizIssuedAt: null,
      activatedUntil: null,
    })
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Strict`,
    )
  }

  return sessionStore.get(sessionId)
}

function resetChallenge(state) {
  const challenge = createChallenge()
  state.targetParams = challenge.targetParams
  state.initialParams = challenge.initialParams
  state.quizQuestions = []
  state.quizIssuedAt = null
}

/**
 * Connect-style middleware for Vite dev server
 */
function createGameApiMiddleware() {
  return function gameApi(req, res, next) {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith('/api/')) {
      next()
      return
    }

    void handleGameApi(req, res, pathname).catch(() => {
      sendJson(res, 500, { message: 'Internal error' })
    })
  }
}

/**
 * Raw Node http handler (pathname without query)
 */
async function handleGameApi(req, res, pathname) {
  if (pathname === '/api/challenge' && req.method === 'GET') {
    const session = getOrCreateSession(req, res)
    if (!requireActivation(session, res)) return
    sendJson(res, 200, {
      initialParams: session.initialParams,
      targetCurve: buildTargetCurveFromParams(session.targetParams),
    })
    return
  }

  if (pathname === '/api/activate' && req.method === 'POST') {
    try {
      const session = getOrCreateSession(req, res)
      const body = await readJsonBody(req)
      const rawCode = String(body?.code ?? '').trim()
      const codeHash = crypto.createHash('sha256').update(rawCode, 'utf8').digest('hex')
      if (codeHash !== ACTIVATION_CODE_HASH) {
        sendJson(res, 403, { message: 'Invalid activation code' })
        return
      }
      session.activatedUntil = Date.now() + ACTIVATION_WINDOW_MS
      resetChallenge(session)
      sendJson(res, 200, {
        ok: true,
        activatedUntil: session.activatedUntil,
        challenge: {
          initialParams: session.initialParams,
          targetCurve: buildTargetCurveFromParams(session.targetParams),
        },
      })
    } catch {
      sendJson(res, 400, { message: 'Malformed request' })
    }
    return
  }

  if (pathname === '/api/deactivate' && req.method === 'POST') {
    const session = getOrCreateSession(req, res)
    session.activatedUntil = null
    resetChallenge(session)
    sendJson(res, 200, { ok: true })
    return
  }

  if (pathname === '/api/train' && req.method === 'POST') {
    try {
      const session = getOrCreateSession(req, res)
      if (!requireActivation(session, res)) return
      const rawBody = await readJsonBody(req)
      const body = sanitizeParams(rawBody)
      if (!body) {
        sendJson(res, 400, { message: 'Invalid payload' })
        return
      }
      const evaluation = evaluateAttemptWithTarget(body, session.targetParams)
      if (!evaluation.unlocked) {
        sendJson(res, 403, { message: 'Threshold not reached (<1% required)' })
        return
      }
      session.quizQuestions = pickTwoQuestions()
      session.quizIssuedAt = Date.now()
      sendJson(res, 200, {
        quiz: toPublicQuestions(session.quizQuestions),
        expiresInMs: QUIZ_TIMEOUT_MS,
      })
    } catch {
      sendJson(res, 400, { message: 'Malformed request' })
    }
    return
  }

  if (pathname === '/api/quiz-submit' && req.method === 'POST') {
    try {
      const session = getOrCreateSession(req, res)
      if (!requireActivation(session, res)) return
      const rawBody = await readJsonBody(req)
      const answers = rawBody?.answers ?? {}
      const validQuiz =
        session.quizQuestions.length === 2 && typeof session.quizIssuedAt === 'number'
      if (!validQuiz) {
        resetChallenge(session)
        sendJson(res, 400, {
          ok: false,
          reason: 'quiz_not_started',
          challenge: {
            initialParams: session.initialParams,
            targetCurve: buildTargetCurveFromParams(session.targetParams),
          },
        })
        return
      }
      const issuedAt = session.quizIssuedAt
      const expired = !issuedAt || Date.now() - issuedAt > QUIZ_TIMEOUT_MS
      const allCorrect = session.quizQuestions.every(
        (q) => answers[q.id] && answers[q.id] === q.answer,
      )
      if (expired || !allCorrect) {
        resetChallenge(session)
        sendJson(res, 403, {
          ok: false,
          reason: expired ? 'timeout' : 'wrong_answers',
          challenge: {
            initialParams: session.initialParams,
            targetCurve: buildTargetCurveFromParams(session.targetParams),
          },
        })
        return
      }
      session.quizQuestions = []
      session.quizIssuedAt = null
      sendJson(res, 200, {
        ok: true,
        key: MODEL_KEY,
      })
    } catch {
      sendJson(res, 400, { message: 'Malformed request' })
    }
    return
  }

  res.statusCode = 404
  res.end()
}

module.exports = {
  createGameApiMiddleware,
  handleGameApi,
}
