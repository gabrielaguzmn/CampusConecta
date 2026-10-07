import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '../auth/AuthProvider'
import { rutas } from '../router'

type Manejador = (peticion: Request) => Response | Promise<Response>

/** Simula la API: `respuestas` va de "MÉTODO /ruta" a la respuesta. Devuelve las peticiones recibidas. */
export function simularApi(respuestas: Record<string, Manejador>) {
  const peticiones: Request[] = []
  vi.stubGlobal('fetch', async (entrada: Request | string, opciones?: RequestInit) => {
    const peticion = entrada instanceof Request ? entrada : new Request(entrada, opciones)
    peticiones.push(peticion.clone())
    const clave = `${peticion.method} ${new URL(peticion.url).pathname}`
    const manejador = respuestas[clave]
    if (!manejador) throw new Error(`Petición no simulada: ${clave}`)
    return manejador(peticion)
  })
  return peticiones
}

export const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

export function renderizarApp(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(
    <QueryClientProvider client={cliente}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return router
}
