import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequiereSesion, SoloSinSesion } from './auth/guards'
import { Layout } from './Layout'
import { FeedPage } from './pages/feed/FeedPage'
import { MapaPage } from './pages/mapa/MapaPage'
import { EventoPage } from './pages/evento/EventoPage'
import { MisEventosPage } from './pages/mis-eventos/MisEventosPage'
import { AdminCategorias } from './pages/admin/AdminCategorias'
import { AdminEventos } from './pages/admin/AdminEventos'
import { AdminLayout, RequiereAdmin } from './pages/admin/AdminLayout'
import { AdminRegistro } from './pages/admin/AdminRegistro'
import { AdminReportes } from './pages/admin/AdminReportes'
import { AdminUsuarios } from './pages/admin/AdminUsuarios'
import { Login } from './pages/acceso/Login'
import { Recuperacion } from './pages/acceso/Recuperacion'
import { Registro } from './pages/acceso/Registro'
import { NuevaContrasena } from './pages/acceso/NuevaContrasena'

// Mapa de rutas: docs/frontend/02_arquitectura.md §2
export const rutas: RouteObject[] = [
  {
    element: <SoloSinSesion />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'registro', element: <Registro /> },
      { path: 'recuperar', element: <Recuperacion /> },
      // G-49: destino del enlace de recuperación (FRONTEND_URL_RECUPERACION = <origen>/recuperar/confirmar)
      { path: 'recuperar/confirmar', element: <NuevaContrasena /> },
    ],
  },
  {
    element: <RequiereSesion />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Navigate to="/feed" replace /> },
          { path: 'feed', element: <FeedPage /> },
          { path: 'mapa', element: <MapaPage /> },
          { path: 'eventos/:id', element: <EventoPage /> },
          { path: 'mis-eventos', element: <MisEventosPage /> },
          { path: 'mis-eventos/historial', element: <MisEventosPage historial key="historial" /> },
          {
            path: 'admin',
            element: <RequiereAdmin />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { index: true, element: <AdminReportes /> },
                  { path: 'eventos', element: <AdminEventos /> },
                  { path: 'usuarios', element: <AdminUsuarios /> },
                  { path: 'categorias', element: <AdminCategorias /> },
                  { path: 'registro', element: <AdminRegistro /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/feed" replace /> },
]

export const router = createBrowserRouter(rutas)
