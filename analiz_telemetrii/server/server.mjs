/**
 * Production: отдаёт собранный фронт и API проверки. Секреты только через переменные окружения.
 */
import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  handleActivateExpress,
  handleBootstrap,
  handleAttemptStatus,
  handleFinishAttempt,
  handleVerifyExpress,
} from './secureApi.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2kb' }))

app.get('/api/attempt/status', handleAttemptStatus)
app.post('/api/attempt/activate', handleActivateExpress)
app.post('/api/attempt/finish', handleFinishAttempt)
app.get('/api/bootstrap', handleBootstrap)
app.post('/api/verify', handleVerifyExpress)

app.use(express.static(dist, { index: false }))

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.path.startsWith('/api')) {
    res.status(404).json({ ok: false, error: 'not_found' })
    return
  }
  res.sendFile(path.join(dist, 'index.html'), (err) => next(err))
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`Server http://localhost:${port}`)
})
