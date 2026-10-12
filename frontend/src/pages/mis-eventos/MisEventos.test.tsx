import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'
import { evento, fecha } from '../../test/datos'

const usuario = { id: 1, nombre: 'Persona De Prueba', email: 'p@x.test', es_administrador: false }
const categorias = [{ id: 2, nombre: 'Categoría de prueba', color: '#123456' }]
const ubicaciones = [{ id: 7, nombre: 'Ubicación de prueba' }]
const normas = [{ id: 3, nombre: 'Respeto y convivencia' }]

const multifecha = evento({
  id: 20,
  nombre: 'Evento multifecha',
  fechas: [
    fecha(1, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z'),
    fecha(2, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z'),
    fecha(3, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z'),
  ],
})
const sencillo = evento({ id: 21, nombre: 'Evento sencillo' })

type Respuestas = Parameters<typeof simularApi>[0]
function iniciar(vigentes: unknown[], extra: Respuestas = {}, historial: unknown[] = []) {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  return simularApi({
    'GET /api/auth/yo/': () => json(usuario),
    'GET /api/categorias/': () => json(categorias),
    'GET /api/ubicaciones/': () => json(ubicaciones),
    'GET /api/normas/': () => json(normas),
    'GET /api/mis-eventos/': (p) => json(new URL(p.url).searchParams.get('vista') === 'historial' ? historial : vigentes),
    ...extra,
  })
}
const cuerpoDe = async (peticiones: Request[], metodo: string, ruta: string) => {
  const peticion = peticiones.find((p) => p.method === metodo && new URL(p.url).pathname === ruta)
  return peticion && (peticion.headers.get('Content-Type')?.includes('json') ? peticion.json() : true)
}

async function abrirGestion(nombre: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Gestionar ${nombre}` }))
  return screen.getByRole('dialog', { name: 'Gestionar evento' })
}

describe('PUBLICATION-2: Mis eventos, estados e historial', () => {
  it('criterio 1: muestra el estado de cada fecha del evento', async () => {
    iniciar([multifecha])
    renderizarApp('/mis-eventos')
    const tarjeta = await screen.findByRole('article', { name: 'Evento multifecha' })
    expect(within(tarjeta).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '✓ 10 Oct. · 16:00–18:00 — Finalizada',
      '● 17 Oct. · 16:00–18:00 — En vivo',
      '○ 24 Oct. · 16:00–18:00 — Próxima',
    ])
    expect(screen.getByText('1 evento activo')).toBeInTheDocument()
  })

  it('criterio 3: el historial se consulta aparte, sin menú de gestión (G-52)', async () => {
    const terminado = evento({ id: 30, nombre: 'Evento terminado', fechas: [fecha(9, 'finalizada', '2026-09-28T22:00:00Z', '2026-09-28T23:30:00Z')] })
    iniciar([sencillo], {}, [terminado])
    renderizarApp('/mis-eventos')
    await userEvent.click(await screen.findByRole('link', { name: 'Historial (Finalizados)' }))
    const tarjeta = await screen.findByRole('article', { name: 'Evento terminado' })
    expect(tarjeta).toHaveTextContent('✓ 28 Sep. · 17:00–18:30Finalizada')
    expect(screen.getByText('1 evento en el historial')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Evento sencillo')).not.toBeInTheDocument()
  })

  it('criterio 4: un evento oculto por moderación se marca con la norma y la explicación (G-44)', async () => {
    iniciar([{ ...sencillo, oculto: true, norma_ocultamiento: 3, explicacion_ocultamiento: 'Explicación de prueba' }])
    renderizarApp('/mis-eventos')
    const tarjeta = await screen.findByRole('article', { name: 'Evento sencillo' })
    expect(within(tarjeta).getByText('Evento oculto por moderación')).toBeInTheDocument()
    expect(await within(tarjeta).findByText('Norma 3: Respeto y convivencia')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Explicación de prueba')).toBeInTheDocument()
  })
})

describe('PUBLICATION-1: creación y publicación de eventos', () => {
  async function completarObligatorios() {
    await userEvent.click(await screen.findByRole('button', { name: 'Crear evento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Crear evento' })
    const en = within(dialogo)
    await userEvent.type(en.getByLabelText('Nombre del evento'), 'Nuevo evento')
    await userEvent.type(en.getByLabelText('Descripción'), 'Descripción nueva')
    await en.findByRole('option', { name: 'Categoría de prueba' })
    await userEvent.selectOptions(en.getByLabelText('Categoría'), '2')
    await en.findByRole('option', { name: 'Ubicación de prueba' })
    await userEvent.selectOptions(en.getByLabelText('Ubicación'), '7')
    await userEvent.type(en.getByLabelText('Responsable'), 'Responsable nuevo')
    await userEvent.type(en.getAllByLabelText('Inicio')[0], '2026-11-02T16:00')
    await userEvent.type(en.getAllByLabelText('Fin')[0], '2026-11-02T18:00')
    return en
  }

  it('criterio 1 y 3: con los datos obligatorios, una fecha y una ubicación del catálogo publica el evento', async () => {
    const peticiones = iniciar([], { 'POST /api/eventos/': () => json({ ...sencillo, id: 99 }, 201) })
    renderizarApp('/mis-eventos')
    const en = await completarObligatorios()
    await userEvent.click(en.getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/eventos/')).toEqual({
      nombre: 'Nuevo evento',
      descripcion: 'Descripción nueva',
      categoria: 2,
      ubicacion: 7,
      detalle_ubicacion: '',
      responsable: 'Responsable nuevo',
      cupo: null,
      contacto: '',
      enlace_externo: '',
      fechas: [{ inicio: '2026-11-02T16:00:00-05:00', fin: '2026-11-02T18:00:00-05:00' }],
    })
  })

  it('criterio 2: cada fecha tiene su propio inicio y fin', async () => {
    const peticiones = iniciar([], { 'POST /api/eventos/': () => json({ ...sencillo, id: 99 }, 201) })
    renderizarApp('/mis-eventos')
    const en = await completarObligatorios()
    await userEvent.click(en.getByRole('button', { name: '+ Añadir otra fecha' }))
    await userEvent.type(en.getAllByLabelText('Inicio')[1], '2026-11-09T10:00')
    await userEvent.type(en.getAllByLabelText('Fin')[1], '2026-11-09T13:30')
    await userEvent.click(en.getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const cuerpo = (await cuerpoDe(peticiones, 'POST', '/api/eventos/')) as { fechas: unknown[] }
    expect(cuerpo.fechas).toEqual([
      { inicio: '2026-11-02T16:00:00-05:00', fin: '2026-11-02T18:00:00-05:00' },
      { inicio: '2026-11-09T10:00:00-05:00', fin: '2026-11-09T13:30:00-05:00' },
    ])
  })

  it('criterio 4: los datos opcionales y la imagen quedan asociados al evento', async () => {
    const peticiones = iniciar([], {
      'POST /api/eventos/': () => json({ ...sencillo, id: 99 }, 201),
      'PUT /api/eventos/99/imagen/': () => json({ ...sencillo, id: 99 }),
    })
    renderizarApp('/mis-eventos')
    const en = await completarObligatorios()
    await userEvent.type(en.getByLabelText('Ubicación exacta (opcional)'), 'Detalle nuevo')
    await userEvent.type(en.getByLabelText('Cupo (opcional)'), '25')
    await userEvent.type(en.getByLabelText('Contacto (opcional)'), 'contacto@x.test')
    await userEvent.type(en.getByLabelText('Enlace (opcional)'), 'https://example.test')
    await userEvent.upload(en.getByLabelText('Imagen (opcional)'), new File(['x'], 'foto.png', { type: 'image/png' }))
    await userEvent.click(en.getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/eventos/')).toMatchObject({
      detalle_ubicacion: 'Detalle nuevo',
      cupo: 25,
      contacto: 'contacto@x.test',
      enlace_externo: 'https://example.test',
    })
    expect(peticiones.some((p) => p.method === 'PUT' && p.url.endsWith('/api/eventos/99/imagen/'))).toBe(true)
  })

  it('DoD: datos inválidos no se publican (fin anterior al inicio)', async () => {
    iniciar([])
    renderizarApp('/mis-eventos')
    const en = await completarObligatorios()
    await userEvent.clear(en.getAllByLabelText('Fin')[0])
    await userEvent.type(en.getAllByLabelText('Fin')[0], '2026-11-02T15:00')
    expect(await en.findByText('El fin debe ser posterior al inicio.')).toBeInTheDocument()
    expect(en.getByRole('button', { name: 'Crear evento' })).toBeDisabled()
  })

  it('DoD: muestra los errores de la API', async () => {
    iniciar([], { 'POST /api/eventos/': () => json({ fechas: [{ inicio: ['No se puede crear una fecha en el pasado.'] }] }, 400) })
    renderizarApp('/mis-eventos')
    const en = await completarObligatorios()
    await userEvent.click(en.getByRole('button', { name: 'Crear evento' }))
    expect(await en.findByRole('alert')).toHaveTextContent('No se puede crear una fecha en el pasado.')
  })
})

describe('PUBLICATION-3: edición de una fecha próxima', () => {
  it('criterio 1, 2 y 4: guarda los cambios, solo envía la fecha próxima modificada y no ofrece las demás', async () => {
    const peticiones = iniciar([multifecha], {
      'PATCH /api/eventos/20/': () => json(multifecha),
      'PATCH /api/fechas/3/': () => json(multifecha.fechas[2]),
    })
    renderizarApp('/mis-eventos')
    await userEvent.click(within(await abrirGestion('Evento multifecha')).getByRole('button', { name: 'Editar' }))
    const en = within(screen.getByRole('dialog', { name: 'Editar evento' }))
    expect(en.getAllByLabelText('Inicio')).toHaveLength(1) // solo la próxima (24 Oct.)
    await userEvent.clear(en.getByLabelText('Fin'))
    await userEvent.type(en.getByLabelText('Fin'), '2026-10-24T19:00')
    await userEvent.click(en.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'PATCH', '/api/fechas/3/')).toEqual({ inicio: '2026-10-24T16:00:00-05:00', fin: '2026-10-24T19:00:00-05:00' })
    expect(peticiones.some((p) => p.url.endsWith('/api/fechas/1/') || p.url.endsWith('/api/fechas/2/'))).toBe(false)
  })
})

describe('PUBLICATION-4: cancelación de una fecha', () => {
  it('criterio 1 y 4: cancela la fecha elegida entre las próximas o en vivo', async () => {
    const peticiones = iniciar([multifecha], { 'POST /api/fechas/3/cancelar/': () => json(multifecha.fechas[2]) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar sesión' }))
    const opciones = within(dialogo).getAllByRole('radio')
    expect(opciones).toHaveLength(2) // en vivo y próxima; la finalizada solo se consulta
    await userEvent.click(within(dialogo).getByLabelText('24 Oct. · 16:00–18:00 — Próxima'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar sesión' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/fechas/3/cancelar/')).toBeTruthy()
  })
})

describe('PUBLICATION-5: cancelación de todas las fechas vigentes', () => {
  it('criterio 1: cancela de una vez todas las fechas próximas o en vivo', async () => {
    const peticiones = iniciar([multifecha], { 'POST /api/eventos/20/cancelar-todas/': () => json(multifecha) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar todas las fechas' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar todas las fechas' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/eventos/20/cancelar-todas/')).toBeTruthy()
  })
})

describe('PUBLICATION-6: finalización anticipada de una fecha en vivo', () => {
  it('criterio 1: finaliza la fecha en vivo', async () => {
    const peticiones = iniciar([multifecha], { 'POST /api/fechas/2/finalizar/': () => json(multifecha.fechas[1]) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Finalizar antes de tiempo' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Finalizar ahora' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/fechas/2/finalizar/')).toBeTruthy()
  })

  it('criterio 2: sin fechas en vivo no se ofrece la acción', async () => {
    iniciar([sencillo])
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sencillo')
    expect(within(dialogo).queryByRole('button', { name: 'Finalizar antes de tiempo' })).not.toBeInTheDocument()
  })
})

describe('PUBLICATION-7: extensión de una fecha en vivo', () => {
  it('criterio 1: aplica el nuevo fin a la fecha en vivo', async () => {
    const peticiones = iniciar([multifecha], { 'POST /api/fechas/2/extender/': () => json(multifecha.fechas[1]) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Extender' }))
    const nuevoFin = within(dialogo).getByLabelText('Nuevo fin')
    expect(nuevoFin).toHaveValue('2026-10-17T18:00')
    await userEvent.clear(nuevoFin)
    await userEvent.type(nuevoFin, '2026-10-17T20:00')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Extender' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/fechas/2/extender/')).toEqual({ fin: '2026-10-17T20:00:00-05:00' })
  })

  it('criterio 2: si la fecha no está en vivo, extender no está disponible', async () => {
    iniciar([sencillo])
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sencillo')
    expect(within(dialogo).queryByRole('button', { name: 'Extender' })).not.toBeInTheDocument()
  })
})

describe('PUBLICATION-8: eliminación del evento (decisión G-10)', () => {
  it('criterio 2: el creador elimina el evento completo tras confirmar', async () => {
    const peticiones = iniciar([sencillo], { 'DELETE /api/eventos/21/': () => new Response(null, { status: 204 }) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sencillo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))
    expect(dialogo).toHaveTextContent('Esta acción no se puede deshacer.')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(peticiones.some((p) => p.method === 'DELETE' && p.url.endsWith('/api/eventos/21/'))).toBe(true)
  })

  it('criterio 2: si el evento tiene fechas que no son próximas, solo se retiran las próximas', async () => {
    const peticiones = iniciar([multifecha], { 'DELETE /api/eventos/20/': () => new Response(null, { status: 204 }) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))
    expect(dialogo).toHaveTextContent('Las sesiones en vivo, finalizadas o canceladas se conservan.')
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar evento' })).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar sesiones próximas' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(peticiones.some((p) => p.method === 'DELETE' && p.url.endsWith('/api/eventos/20/'))).toBe(true)
  })

  it('criterio 1: elimina una sesión próxima elegida; las demás no cambian', async () => {
    const dosProximas = evento({
      id: 22,
      nombre: 'Evento con dos próximas',
      fechas: [fecha(5, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z'), fecha(6, 'proxima', '2026-10-31T21:00:00Z', '2026-10-31T23:00:00Z')],
    })
    const peticiones = iniciar([dosProximas], { 'DELETE /api/fechas/6/': () => new Response(null, { status: 204 }) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento con dos próximas')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar sesión' }))
    expect(within(dialogo).getByRole('button', { name: 'Eliminar sesión' })).toBeDisabled()
    await userEvent.click(within(dialogo).getByLabelText(/31 Oct\./))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar sesión' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(peticiones.some((p) => p.method === 'DELETE' && p.url.endsWith('/api/fechas/6/'))).toBe(true)
    expect(peticiones.some((p) => p.method === 'DELETE' && p.url.endsWith('/api/fechas/5/'))).toBe(false)
  })

  it('una sola fecha no ofrece eliminar sesión: se elimina el evento', async () => {
    iniciar([sencillo])
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sencillo')
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar sesión' })).not.toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('criterio 3: sin fechas próximas no hay nada que eliminar', async () => {
    const sinProximas = evento({
      id: 23,
      nombre: 'Evento sin próximas',
      fechas: [fecha(7, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z'), fecha(8, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z')],
    })
    iniciar([sinProximas])
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sin próximas')
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).not.toBeInTheDocument()
  })

  it('criterio 3: si la API lo impide (fechas no próximas, G-24) se muestra su mensaje', async () => {
    iniciar([multifecha], {
      'DELETE /api/eventos/20/': () => json({ detail: 'Solo se puede eliminar un evento cuyas fechas son todas próximas.', code: 'pendiente_g24' }, 409),
    })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar evento' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Solo se puede eliminar un evento cuyas fechas son todas próximas.')
  })
})

describe('G-30: añadir una fecha a un evento vigente', () => {
  it('envía la nueva fecha con su inicio y fin', async () => {
    const peticiones = iniciar([sencillo], { 'POST /api/eventos/21/fechas/': () => json(sencillo.fechas[0], 201) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento sencillo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Añadir fecha' }))
    await userEvent.type(within(dialogo).getByLabelText('Inicio'), '2026-11-20T09:00')
    await userEvent.type(within(dialogo).getByLabelText('Fin'), '2026-11-20T11:00')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Añadir fecha' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await cuerpoDe(peticiones, 'POST', '/api/eventos/21/fechas/')).toEqual({ inicio: '2026-11-20T09:00:00-05:00', fin: '2026-11-20T11:00:00-05:00' })
  })
})

describe('RNF-005 · PUBLICATION-3 · criterio 3: los cambios se ven en la siguiente consulta', () => {
  it('tras una acción de gestión se vuelve a consultar Mis Eventos', async () => {
    const peticiones = iniciar([multifecha], { 'POST /api/fechas/3/cancelar/': () => json(multifecha.fechas[2]) })
    renderizarApp('/mis-eventos')
    const dialogo = await abrirGestion('Evento multifecha')
    const consultas = () => peticiones.filter((p) => p.method === 'GET' && new URL(p.url).pathname === '/api/mis-eventos/').length
    const antes = consultas()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar sesión' }))
    await userEvent.click(within(dialogo).getByLabelText('24 Oct. · 16:00–18:00 — Próxima'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar sesión' }))
    await waitFor(() => expect(consultas()).toBeGreaterThan(antes))
  })
})
