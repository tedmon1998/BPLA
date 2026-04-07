import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearActivationSession,
  getSessionEndMs,
  isSessionValidNow,
  setSessionEndMs,
} from './activationStorage'
import { verifyActivationCode } from './verifyActivation'

const SESSION_DURATION_MS = 20 * 60 * 1000

type ActivationStatus = 'checking' | 'locked' | 'unlocked'

type ActivationContextValue = {
  status: ActivationStatus
  secondsLeft: number
  error: string | null
  submitCode: (code: string) => Promise<void>
  endAttempt: () => void
}

const ActivationContext = createContext<ActivationContextValue | null>(null)

export function useActivation(): ActivationContextValue {
  const value = useContext(ActivationContext)
  if (!value) {
    throw new Error('useActivation must be used within ActivationProvider')
  }
  return value
}

export function ActivationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ActivationStatus>('checking')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSessionValidNow()) {
      setStatus('unlocked')
    } else {
      clearActivationSession()
      setStatus('locked')
    }
  }, [])

  const refreshSecondsLeft = useCallback(() => {
    const end = getSessionEndMs()
    if (!end) {
      return 0
    }
    return Math.max(0, Math.floor((end - Date.now()) / 1000))
  }, [])

  useEffect(() => {
    if (status !== 'unlocked') {
      return
    }
    setSecondsLeft(refreshSecondsLeft())
    const id = window.setInterval(() => {
      const left = refreshSecondsLeft()
      setSecondsLeft(left)
      if (left <= 0) {
        clearActivationSession()
        setStatus('locked')
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [status, refreshSecondsLeft])

  const submitCode = useCallback(async (code: string) => {
    setError(null)
    const ok = await verifyActivationCode(code)
    if (!ok) {
      setError('Неверный код. Попробуйте снова.')
      return
    }
    const end = Date.now() + SESSION_DURATION_MS
    setSessionEndMs(end)
    setSecondsLeft(Math.floor(SESSION_DURATION_MS / 1000))
    setStatus('unlocked')
  }, [])

  const endAttempt = useCallback(() => {
    clearActivationSession()
    setError(null)
    setStatus('locked')
    setSecondsLeft(0)
  }, [])

  const value = useMemo<ActivationContextValue>(
    () => ({
      status,
      secondsLeft,
      error,
      submitCode,
      endAttempt,
    }),
    [status, secondsLeft, error, submitCode, endAttempt],
  )

  return (
    <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>
  )
}
