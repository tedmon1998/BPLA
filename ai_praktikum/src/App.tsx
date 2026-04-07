import { RouterProvider } from 'react-router-dom'
import { appRouter } from './app/router'
import { ActivationProvider } from './shared/auth/ActivationContext'
import { ActivationShell } from './shared/auth/ActivationShell'

function App() {
  return (
    <ActivationProvider>
      <ActivationShell>
        <RouterProvider router={appRouter} />
      </ActivationShell>
    </ActivationProvider>
  )
}

export default App
