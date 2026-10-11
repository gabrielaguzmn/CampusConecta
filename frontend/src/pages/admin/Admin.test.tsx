import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'
import { evento, fecha } from '../../test/datos'

const admin = { id: 1, nombre: 'Admin De Prueba', email: 'admin@x.test', es_administrador: true }
const normas = [{ id: 3, nombre: 'Respeto y convivencia' }]
const creador = { id: 2, nombre: 'Creador De Prueba', email: 'creador@x.test' }

type Respuestas = Parameters<typeof simularApi>[0]
function iniciar(respuestas: Respuestas, usuario: object = admin) {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  return simularApi({ 'GET /api/auth/yo/': () => json(usuario), 'GET /api/normas/': () => json(normas), ...respuestas })
}
const cuerpo = (peticiones: Request[], metodo: string, ruta: string) =>
  peticiones.find((p) => p.method === metodo && new URL(p.url).pathname === ruta)?.json()
const ok = () => json({})

describe('RF-024: acceso al módulo de administración', () => {
  it('un usuario sin rol administrador no ve el enlace y es redirigido', async () => {
    iniciar({ 'GET /api/categorias/': () => json([]), 'GET /api/eventos/': () => json([]) }, { ...admin, es_administrador: false })
    const router = renderizarApp('/admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'))
    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
  })

  it('un administrador ve el enlace y las secciones', async () => {
    iniciar({ 'GET /api/admin/casos/': () => json([]) })
    renderizarApp('/admin')
    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin')
    for (const seccion of ['Reportes', 'Eventos', 'Usuarios', 'Categorías', 'Registro']) {
      expect(screen.getByRole('link', { name: seccion })).toBeInTheDocument()
    }
  })
})

describe('ADMIN-2: gestión y resolución de reportes', () => {
  const caso = (estado: string) => ({
    id: 8,
    evento: { id: 5, nombre: 'Evento reportado', oculto: false, creador },
    estado,
    decision_ocultar: null,
    reportes: [
      { id: 1, usuario: { id: 3, nombre: 'Persona Uno', email: 'u@x.test' }, causa: 3, detalles: 'Detalle uno' },
      { id: 2, usuario: { id: 4, nombre: 'Persona Dos', email: 'd@x.test' }, causa: 3 },
    ],
  })

  it('criterio 1: varios reportes de un evento se presentan como un único caso', async () => {
    iniciar({ 'GET /api/admin/casos/': () => json([caso('pendiente')]) })
    renderizarApp('/admin')
    const tarjeta = await screen.findByRole('article', { name: 'Caso de Evento reportado' })
    expect(within(tarjeta).getByText('2 reportes')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Pendiente por revisión')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Detalle uno')).toBeInTheDocument()
  })

  it('criterio 2: el caso pasa de pendiente por revisión a en revisión', async () => {
    const peticiones = iniciar({ 'GET /api/admin/casos/': () => json([caso('pendiente')]), 'PATCH /api/admin/casos/8/': () => json(caso('en_revision')) })
    renderizarApp('/admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a revisión' }))
    await waitFor(async () => expect(await cuerpo(peticiones, 'PATCH', '/api/admin/casos/8/')).toEqual({ estado: 'en_revision', explicacion: '' }))
  })

  it('criterio 3: al revisarlo decide ocultar el evento con la norma incumplida', async () => {
    const peticiones = iniciar({ 'GET /api/admin/casos/': () => json([caso('en_revision')]), 'PATCH /api/admin/casos/8/': () => json(caso('revisado')) })
    renderizarApp('/admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como revisado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar el evento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Ocultar evento' })
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.type(within(dialogo).getByLabelText('Explicación (opcional)'), 'Contenido ofensivo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ocultar evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'PATCH', '/api/admin/casos/8/')).toEqual({ estado: 'revisado', decision_ocultar: true, norma: 3, explicacion: 'Contenido ofensivo' })
  })

  it('criterio 3: también puede decidir que permanezca visible', async () => {
    const peticiones = iniciar({ 'GET /api/admin/casos/': () => json([caso('en_revision')]), 'PATCH /api/admin/casos/8/': () => json(caso('revisado')) })
    renderizarApp('/admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como revisado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mantener visible' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'PATCH', '/api/admin/casos/8/')).toEqual({ estado: 'revisado', decision_ocultar: false, explicacion: '' })
  })
})

describe('ADMIN-1: moderación de eventos y fechas', () => {
  const visible = evento({
    id: 5,
    nombre: 'Evento moderado',
    fechas: [fecha(1, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z'), fecha(2, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z')],
  })

  it('criterio 1 y 4: oculta el evento con su motivo', async () => {
    const peticiones = iniciar({ 'GET /api/admin/eventos/': () => json([visible]), 'POST /api/admin/eventos/5/ocultar/': () => json(visible) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar evento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Ocultar evento' })
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ocultar evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'POST', '/api/admin/eventos/5/ocultar/')).toEqual({ norma: 3, explicacion: '' })
  })

  it('criterio 2: restaura un evento oculto', async () => {
    const peticiones = iniciar({
      'GET /api/admin/eventos/': () => json([{ ...visible, oculto: true, norma_ocultamiento: 3 }]),
      'POST /api/admin/eventos/5/restaurar/': () => json(visible),
    })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar evento' }))
    await waitFor(() => expect(peticiones.some((p) => p.method === 'POST' && p.url.endsWith('/api/admin/eventos/5/restaurar/'))).toBe(true))
  })

  it('criterio 3: una fecha finalizada no admite moderación; las demás sí', async () => {
    iniciar({ 'GET /api/admin/eventos/': () => json([visible]) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    const dialogo = screen.getByRole('dialog', { name: 'Moderar evento' })
    expect(within(dialogo).getByRole('button', { name: 'Ocultar sesión del 24 Oct. · 16:00–18:00' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: /10 Oct\./ })).not.toBeInTheDocument()
  })

  it('filtra entre eventos visibles y ocultos', async () => {
    const peticiones = iniciar({ 'GET /api/admin/eventos/': () => json([]) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Ocultos' }))
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/api/admin/eventos/?oculto=true'))).toBe(true))
  })

  it('PUBLICATION-8 · criterio 4: elimina el evento con su motivo tras elegir la norma', async () => {
    const peticiones = iniciar({ 'GET /api/admin/eventos/': () => json([visible]), 'POST /api/admin/eventos/5/eliminar/': () => new Response(null, { status: 204 }) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar evento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar evento' })
    expect(dialogo).toHaveTextContent('Esta acción no se puede deshacer.')
    expect(within(dialogo).getByRole('button', { name: 'Eliminar evento' })).toBeDisabled()
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.type(within(dialogo).getByLabelText('Explicación (opcional)'), 'Ofensivo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'POST', '/api/admin/eventos/5/eliminar/')).toEqual({ norma: 3, explicacion: 'Ofensivo' })
  })

  it('PUBLICATION-8 · criterio 4: elimina una sesión vigente; las finalizadas no se ofrecen', async () => {
    const peticiones = iniciar({ 'GET /api/admin/eventos/': () => json([visible]), 'POST /api/admin/fechas/2/eliminar/': () => new Response(null, { status: 204 }) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    const moderar = screen.getByRole('dialog', { name: 'Moderar evento' })
    expect(within(moderar).queryByRole('button', { name: /^Eliminar sesión del 10 Oct\./ })).not.toBeInTheDocument()
    await userEvent.click(within(moderar).getByRole('button', { name: 'Eliminar sesión del 24 Oct. · 16:00–18:00' }))
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar sesión' })
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar sesión' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'POST', '/api/admin/fechas/2/eliminar/')).toEqual({ norma: 3, explicacion: '' })
  })

  it('PUBLICATION-8 · criterio 4: la única fecha obliga a eliminar el evento y un evento caducado no se elimina', async () => {
    const unica = evento({ id: 6, nombre: 'Evento de una fecha', fechas: [fecha(3, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z')] })
    const caducado = evento({ id: 7, nombre: 'Evento caducado', fechas: [fecha(4, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z')] })
    iniciar({ 'GET /api/admin/eventos/': () => json([unica, caducado]) })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento de una fecha' }))
    let dialogo = screen.getByRole('dialog', { name: 'Moderar evento' })
    expect(within(dialogo).getByRole('button', { name: 'Eliminar evento' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar sesión/ })).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Moderar Evento caducado' }))
    dialogo = screen.getByRole('dialog', { name: 'Moderar evento' })
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).not.toBeInTheDocument()
  })

  it('muestra el motivo de la API si no se puede eliminar', async () => {
    iniciar({
      'GET /api/admin/eventos/': () => json([visible]),
      'POST /api/admin/eventos/5/eliminar/': () => json({ detail: 'El evento ya no tiene fechas próximas o en vivo.', code: 'contenido_caducado' }, 409),
    })
    renderizarApp('/admin/eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Moderar Evento moderado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar evento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar evento' })
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar evento' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El evento ya no tiene fechas próximas o en vivo.')
  })
})

describe('ADMIN-3 y ADMIN-4: cuentas y administradores', () => {
  const persona = { id: 2, nombre: 'Creador De Prueba', email: 'creador@x.test', es_administrador: false, suspendida: false }

  it('ADMIN-3 · criterio 1 y 4: suspende una cuenta con la norma incumplida', async () => {
    const peticiones = iniciar({ 'GET /api/admin/usuarios/': () => json([persona]), 'POST /api/admin/usuarios/2/suspender/': () => json({}) })
    renderizarApp('/admin/usuarios')
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender cuenta' }))
    const dialogo = screen.getByRole('dialog', { name: 'Suspender cuenta' })
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Norma incumplida'), '3')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Suspender cuenta' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'POST', '/api/admin/usuarios/2/suspender/')).toEqual({ norma: 3, explicacion: '' })
  })

  it('ADMIN-3 · criterio 3: reactiva una cuenta suspendida', async () => {
    const peticiones = iniciar({ 'GET /api/admin/usuarios/': () => json([{ ...persona, suspendida: true }]), 'POST /api/admin/usuarios/2/reactivar/': ok })
    renderizarApp('/admin/usuarios')
    expect(await screen.findByText('Suspendida')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar cuenta' }))
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/api/admin/usuarios/2/reactivar/'))).toBe(true))
  })

  it('ADMIN-4 · criterio 2: asigna y revoca el rol administrador', async () => {
    const peticiones = iniciar({
      'GET /api/admin/usuarios/': () => json([persona, { ...persona, id: 9, nombre: 'Otra Admin', es_administrador: true }]),
      'POST /api/admin/usuarios/2/asignar-admin/': ok,
      'POST /api/admin/usuarios/9/revocar-admin/': ok,
    })
    renderizarApp('/admin/usuarios')
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer administrador' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revocar administrador' }))
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/api/admin/usuarios/9/revocar-admin/'))).toBe(true))
    expect(peticiones.some((p) => p.url.endsWith('/api/admin/usuarios/2/asignar-admin/'))).toBe(true)
  })

  it('no permite suspender la propia cuenta y la marca como "(tú)"', async () => {
    iniciar({ 'GET /api/admin/usuarios/': () => json([{ ...admin, suspendida: false }]) })
    renderizarApp('/admin/usuarios')
    expect(await screen.findByText('(tú)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suspender cuenta' })).toBeDisabled()
  })

  it('ADMIN-4 · criterios 3 y 4: el registro muestra los datos de trazabilidad y no se puede editar', async () => {
    iniciar({
      'GET /api/admin/registro/': () =>
        json([
          {
            id: 1,
            fecha_hora: '2026-10-07T15:30:00Z',
            administrador: { id: 1, nombre: 'Admin De Prueba', email: 'admin@x.test' },
            tipo_accion: 'ocultar',
            evento: 5,
            fecha: null,
            cuenta_afectada: creador,
            norma: 3,
            explicacion: 'Contenido ofensivo',
            reportes: [1, 2],
            estado_anterior: 'visible',
            estado_posterior: 'oculto',
          },
        ]),
    })
    renderizarApp('/admin/registro')
    expect(await screen.findByText('Ocultar')).toBeInTheDocument()
    expect(screen.getByText('Admin De Prueba · admin@x.test')).toBeInTheDocument()
    expect(screen.getByText('Creador De Prueba · creador@x.test')).toBeInTheDocument()
    expect(screen.getByText('Evento #5')).toBeInTheDocument()
    expect(screen.getByText('visible → oculto')).toBeInTheDocument()
    expect(await screen.findByText('Norma 3: Respeto y convivencia — Contenido ofensivo')).toBeInTheDocument()
    expect(screen.getByText('#1, #2')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('CATEGORY-1: gestión del catálogo de categorías', () => {
  const ventas = { id: 1, nombre: 'Ventas', activa: true, color: '#952D2D' }

  it('criterio 2: crea una categoría con su color (decisión G-54)', async () => {
    const peticiones = iniciar({ 'GET /api/admin/categorias/': () => json([ventas]), 'POST /api/admin/categorias/': () => json({ id: 7 }, 201) })
    renderizarApp('/admin/categorias')
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva categoría' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nueva categoría' })
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Ferias')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear categoría' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'POST', '/api/admin/categorias/')).toEqual({ nombre: 'Ferias', color: '#950000' })
  })

  it('criterio 2: renombra una categoría', async () => {
    const peticiones = iniciar({ 'GET /api/admin/categorias/': () => json([ventas]), 'PATCH /api/admin/categorias/1/': ok })
    renderizarApp('/admin/categorias')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const nombre = within(screen.getByRole('dialog', { name: 'Editar categoría' })).getByLabelText('Nombre')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Ventas y bazares')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpo(peticiones, 'PATCH', '/api/admin/categorias/1/')).toEqual({ nombre: 'Ventas y bazares', color: '#952D2D' })
  })

  it('criterio 3: activa o desactiva una categoría', async () => {
    const peticiones = iniciar({ 'GET /api/admin/categorias/': () => json([ventas]), 'PATCH /api/admin/categorias/1/': ok })
    renderizarApp('/admin/categorias')
    expect(await screen.findByText('Activa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    await waitFor(async () => expect(await cuerpo(peticiones, 'PATCH', '/api/admin/categorias/1/')).toEqual({ activa: false }))
  })
})
