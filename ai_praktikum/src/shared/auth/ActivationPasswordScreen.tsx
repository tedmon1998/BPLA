import { useState } from 'react'
import type { FormEvent } from 'react'
import { useActivation } from './ActivationContext'

export function ActivationPasswordScreen() {
  const { submitCode, error } = useActivation()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await submitCode(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="activation-screen">
      <div className="activation-card">
        <h1 className="activation-title">Активация</h1>
        <p className="activation-hint">Введите код активации, чтобы начать работу с практикумом.</p>
        <form onSubmit={onSubmit} className="activation-form">
          <label className="activation-label" htmlFor="activation-code">
            Код
          </label>
          <input
            id="activation-code"
            type="password"
            autoComplete="off"
            className="activation-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            placeholder="•••••••"
          />
          {error ? <p className="activation-error">{error}</p> : null}
          <button type="submit" className="activation-submit" disabled={busy}>
            {busy ? 'Проверка…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
