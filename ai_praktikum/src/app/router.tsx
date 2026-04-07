import { Navigate, createHashRouter } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { LevelFlowPage } from '../pages/LevelFlowPage'
import { APP_ROUTES } from '../shared/config/routes'

/** HashRouter: корректная работа при загрузке `dist/index.html` из Electron (`file://`). */
export const appRouter = createHashRouter([
  {
    path: APP_ROUTES.home,
    element: <AppLayout />,
    children: [
      { index: true, element: <LevelFlowPage /> },
      { path: '*', element: <Navigate to={APP_ROUTES.home} replace /> },
    ],
  },
])
