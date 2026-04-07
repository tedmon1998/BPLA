const SESSION_END_KEY = 'activation_session_end_ms'

export function getSessionEndMs(): number | null {
  const raw = sessionStorage.getItem(SESSION_END_KEY)
  if (!raw) {
    return null
  }
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : null
}

export function setSessionEndMs(endMs: number): void {
  sessionStorage.setItem(SESSION_END_KEY, String(endMs))
}

export function clearActivationSession(): void {
  sessionStorage.removeItem(SESSION_END_KEY)
}

export function isSessionValidNow(): boolean {
  const end = getSessionEndMs()
  return end !== null && Date.now() < end
}
