import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequiereSesion, SoloSinSesion } from './auth/guards'
import { Layout } from './Layout'
import { Login } from './pages/acceso/Login'
import { Recuperacion } from './pages/acceso/Recuperacion'
import { Registro } from './pages/acceso/Registro'

// Mapa de rutas: docs/frontend/02_arquitectura.md §2
export const rutas: RouteObject[] = [
  {
    element: <SoloSinSesion />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'registro', element: <Registro /> },
      { path: 'recuperar', element: <Recuperacion /> },
      // TODO(PENDIENTE G-49: página para la nueva contraseña con uid y token, sin diseño)
    ],
  },
  {
    element: <RequiereSesion />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Navigate to="/feed" replace /> },
          // TODO(capa 3: Feed) · TODO(capa 4: Mapa) · TODO(capa 5: Mis Eventos)
          { path: 'feed', element: null },
          { path: 'mapa', element: null },
          { path: 'mis-eventos', element: null },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/feed" replace /> },
]

export const router = createBrowserRouter(rutas)
