import type { ReactNode } from 'react'
import { ActivationPasswordScreen } from './ActivationPasswordScreen'
import { useActivation } from './ActivationContext'

export function ActivationShell({ children }: { children: ReactNode }) {
  const { status } = useActivation()

  if (status === 'checking') {
    return (
      <div className="activation-screen">
        <p className="activation-loading">Загрузка…</p>
      </div>
    )
  }

  if (status === 'locked') {
    return <ActivationPasswordScreen />
  }

  return <>{children}</>
}
