import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useGameStore } from '../store/gameStore'

const ATTEMPT_MS = 20 * 60 * 1000

// SHA-256 hash of the activation code (code itself must not be shown in UI).
// This prevents the plain code from appearing in the source as digits.
const ACTIVATION_CODE_SHA256_HEX = 'f3e3b70491b3076d08961837f676be0bca148fd8a17c18c86e1b698417cf381c'

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function ActivationScreen() {
  const activate = useGameStore((s) => s.activateAttempt)
  const endAttempt = useGameStore((s) => s.endAttempt)
  const attemptEndsAtMs = useGameStore((s) => s.attemptEndsAtMs)

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])

  const remainingMs = useMemo(() => {
    if (!attemptEndsAtMs) return 0
    return Math.max(0, attemptEndsAtMs - nowMs)
  }, [attemptEndsAtMs, nowMs])

  const remainingMin = Math.floor(remainingMs / 60000)
  const remainingSec = Math.floor((remainingMs % 60000) / 1000)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const hex = await sha256Hex(code.trim())
      if (hex !== ACTIVATION_CODE_SHA256_HEX) {
        setError('Неверный код активации.')
        return
      }
      activate(Date.now() + ATTEMPT_MS)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>Активация</h2>
      <p style={{ opacity: 0.9, marginTop: 0 }}>
        Введите код активации. После активации даётся 20 минут.
      </p>

      {attemptEndsAtMs ? (
        <div className="stack">
          <div>
            Активировано. Осталось: <strong>{remainingMin.toString().padStart(2, '0')}</strong>:
            <strong>{remainingSec.toString().padStart(2, '0')}</strong>
          </div>
          <button type="button" onClick={endAttempt}>
            Закончить попытку
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Код активации
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="Введите код"
            />
          </label>
          <button type="submit" disabled={busy || code.trim().length === 0}>
            Активировать
          </button>
          {error && <div style={{ color: '#ffb4c0', fontWeight: 700 }}>{error}</div>}
        </form>
      )}
    </section>
  )
}

