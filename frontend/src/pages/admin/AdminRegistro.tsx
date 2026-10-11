import { useRegistro } from '../../api/admin'
import { useNormas } from '../../api/queries'
import { Cargando, Pildora } from './comunes'

// ADMIN-4 · criterios 3 y 4 · RF-034: registro completo y de solo lectura (sin acciones de edición ni borrado).
const ACCIONES = { ocultar: 'Ocultar', restaurar: 'Restaurar', suspender: 'Suspender', reactivar: 'Reactivar', eliminar: 'Eliminar' } as const
const ACCIONES_DE_ALERTA = ['ocultar', 'suspender', 'eliminar']

const fechaHora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })

export function AdminRegistro() {
  const registro = useRegistro()
  const normas = useNormas()
  return (
    <Cargando consulta={registro} vacio={registro.data?.length === 0}>
      <ul className="flex flex-col gap-4">
        {registro.data?.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
            <div className="flex flex-wrap items-center gap-2">
              <Pildora tono={ACCIONES_DE_ALERTA.includes(r.tipo_accion) ? 'alerta' : 'ok'}>{ACCIONES[r.tipo_accion]}</Pildora>
              <span className="text-[13px] text-texto-secundario">{fechaHora.format(new Date(r.fecha_hora))}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
              <div>
                <dt className="font-semibold">Administrador</dt>
                <dd className="text-texto-secundario">{r.administrador.nombre} · {r.administrador.email}</dd>
              </div>
              <div>
                <dt className="font-semibold">Cuenta afectada</dt>
                <dd className="text-texto-secundario">{r.cuenta_afectada.nombre} · {r.cuenta_afectada.email}</dd>
              </div>
              {(r.evento != null || r.fecha != null) && (
                <div>
                  <dt className="font-semibold">Contenido</dt>
                  <dd className="text-texto-secundario">
                    {r.fecha != null ? `Fecha #${r.fecha}` : ''}
                    {r.fecha != null && r.evento != null ? ' · ' : ''}
                    {r.evento != null ? `Evento #${r.evento}` : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-semibold">Estado</dt>
                <dd className="text-texto-secundario">
                  {r.estado_anterior} → {r.estado_posterior}
                </dd>
              </div>
              {r.norma != null && (
                <div>
                  <dt className="font-semibold">Motivo</dt>
                  <dd className="text-texto-secundario">
                    Norma {r.norma}
                    {normas.data ? `: ${normas.data.find((n) => n.id === r.norma)?.nombre ?? ''}` : ''}
                    {r.explicacion ? ` — ${r.explicacion}` : ''}
                  </dd>
                </div>
              )}
              {r.reportes && r.reportes.length > 0 && (
                <div>
                  <dt className="font-semibold">Reportes asociados</dt>
                  <dd className="text-texto-secundario">{r.reportes.map((id) => `#${id}`).join(', ')}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </Cargando>
  )
}
