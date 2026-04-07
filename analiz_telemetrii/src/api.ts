export type BootstrapResult = { csrfToken: string; remainingSec?: number }

let bootstrapPromise: Promise<BootstrapResult> | null = null

/**
 * Один запрос bootstrap на загрузку приложения (устойчиво к React StrictMode).
 * Cookie session + csrf для защиты от «голого» POST без контекста страницы.
 */
export function ensureBootstrap(): Promise<BootstrapResult> {
  if (!bootstrapPromise) {
    bootstrapPromise = fetch('/api/bootstrap', {
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(async (r) => {
      if (!r.ok) throw new Error('bootstrap_failed')
      return r.json() as Promise<BootstrapResult>
    })
  }
  return bootstrapPromise
}

export function resetBootstrap(): void {
  bootstrapPromise = null
}

export type AttemptStatus = {
  active: boolean
  remainingSec: number
}

export async function getAttemptStatus(): Promise<AttemptStatus> {
  const r = await fetch('/api/attempt/status', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!r.ok) throw new Error('status_failed')
  const data = (await r.json()) as { active?: boolean; remainingSec?: number }
  return {
    active: Boolean(data.active),
    remainingSec:
      typeof data.remainingSec === 'number' && Number.isFinite(data.remainingSec)
        ? Math.max(0, Math.floor(data.remainingSec))
        : 0,
  }
}

export type ActivateResult = { ok: true; remainingSec: number } | { ok: false; error?: string }

export async function activateAttempt(code: string): Promise<ActivateResult> {
  const r = await fetch('/api/attempt/activate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ code }),
  })
  const obj = (await r.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    remainingSec?: number
  }
  if (obj.ok) {
    resetBootstrap()
    return { ok: true, remainingSec: Math.max(0, Math.floor(obj.remainingSec ?? 0)) }
  }
  return { ok: false, error: obj.error }
}

export async function finishAttempt(): Promise<void> {
  await fetch('/api/attempt/finish', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  resetBootstrap()
}

export type VerifyResult =
  | { ok: true; code: string }
  | { ok: false; error?: string }

export async function verifyClick(
  timeSec: number,
  countryIso2: string,
): Promise<VerifyResult> {
  const { csrfToken } = await ensureBootstrap()
  const r = await fetch('/api/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ timeSec, countryIso2, csrfToken }),
  })

  let data: unknown
  try {
    data = await r.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const obj = data as { ok?: boolean; code?: string; error?: string }

  if (obj.ok && typeof obj.code === 'string') {
    resetBootstrap()
    return { ok: true, code: obj.code }
  }

  if (r.status === 429) return { ok: false, error: 'rate_limited' }
  if (r.status === 401) {
    resetBootstrap()
    return { ok: false, error: obj.error || 'session_required' }
  }
  if (r.status === 403) return { ok: false, error: 'invalid_token' }
  if (r.status === 400 && obj.error === 'too_fast')
    return { ok: false, error: 'too_fast' }
  if (r.status === 400 && obj.error === 'bad_country')
    return { ok: false, error: 'bad_country' }
  if (obj.error === 'wrong_time') return { ok: false, error: 'wrong_time' }
  if (obj.error === 'wrong_country') return { ok: false, error: 'wrong_country' }
  if (obj.error === 'wrong_both') return { ok: false, error: 'wrong_both' }

  return { ok: false, error: obj.error }
}
