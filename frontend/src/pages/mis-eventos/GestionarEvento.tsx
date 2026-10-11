import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarOff, CalendarPlus, CalendarX, CircleStop, ClockPlus, Pencil, Trash2 } from 'lucide-react'
import { api, todosLosMensajes } from '../../api/client'
import type { components } from '../../api/schema'
import { AccionModal } from '../../components/AccionModal'
import { CampoTexto } from '../../components/CampoTexto'
import { Modal } from '../../components/Modal'
import { formatoDiaYHorario, isoALocal, localAIso } from '../../lib/formato'

type Evento = components['schemas']['Evento']
type Fecha = components['schemas']['Fecha']
type Paso = 'menu' | 'cancelar' | 'cancelar-todas' | 'finalizar' | 'extender' | 'anadir' | 'eliminar'

// Figma 4:29200 / 4:29792 · «Gestionar evento»: Editar, Cancelar y Eliminar.
// Decisiones 2026-10-07: «Cancelar» cancela una fecha elegida (G-10); «Eliminar» borra el evento completo (RF-017).
// Las demás acciones (RF-014, RF-015, RF-016, añadir fecha de G-30) no tienen diseño y se añaden con el mismo estilo (G-12).
function ElegirFecha({ fechas, elegida, onElegir }: { fechas: Fecha[]; elegida?: number; onElegir: (id: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Sesión</legend>
      {fechas.map((f) => (
        <label key={f.id} className="flex h-13 cursor-pointer items-center gap-3 rounded-control border border-borde px-4 text-sm has-checked:border-accion">
          <input type="radio" name="fecha" checked={elegida === f.id} onChange={() => onElegir(f.id)} className="accent-accion" />
          {formatoDiaYHorario(f.inicio, f.fin)} — {f.estado === 'en_vivo' ? 'En vivo' : 'Próxima'}
        </label>
      ))}
    </fieldset>
  )
}

export function GestionarEvento({ evento, onEditar, onCerrar }: { evento: Evento; onEditar: () => void; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const [paso, setPaso] = useState<Paso>('menu')
  const [elegida, setElegida] = useState<number>()
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)

  const vigentes = evento.fechas.filter((f) => f.estado === 'proxima' || f.estado === 'en_vivo')
  const enVivo = evento.fechas.filter((f) => f.estado === 'en_vivo')
  // PUBLICATION-7: solo se acepta un fin posterior al actual de la sesión en vivo.
  const fechaElegida = evento.fechas.find((f) => f.id === elegida)
  const finValido = Boolean(fechaElegida && fin && fin > isoALocal(fechaElegida.fin))
  const lugar = [evento.detalle_ubicacion, evento.ubicacion.nombre].filter(Boolean).join(' · ')

  function ir(siguiente: Paso, fechas: Fecha[] = []) {
    setErrores([])
    const unica = fechas.length === 1 ? fechas[0] : undefined
    setElegida(unica?.id)
    setFin(siguiente === 'extender' && unica ? isoALocal(unica.fin) : '')
    setInicio('')
    setPaso(siguiente)
  }

  async function ejecutar(accion: () => Promise<{ error?: unknown; response: Response }>) {
    setEnviando(true)
    setErrores([])
    const { error, response } = await accion()
    setEnviando(false)
    if (!response.ok) return setErrores(todosLosMensajes(error))
    // RNF-005: el cambio se ve en la siguiente consulta de Mis Eventos, el feed y el mapa.
    await Promise.all(['mis-eventos', 'eventos', 'mapa', 'evento'].map((clave) => cliente.invalidateQueries({ queryKey: [clave] })))
    onCerrar()
  }

  const ruta = { params: { path: { id: elegida ?? 0 } } }
  const delEvento = { params: { path: { id: evento.id } } }

  let contenido: ReactNode
  if (paso === 'menu') {
    contenido = (
      <>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-bold">{evento.nombre}</p>
          <p className="text-sm text-texto-secundario">{lugar}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-texto">Sesiones</p>
          <ul className="flex flex-col gap-2">
            {evento.fechas.map((fecha) => (
              <li key={fecha.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className={fecha.estado === 'en_vivo' ? 'text-accion' : fecha.estado === 'cancelada' ? 'text-destructivo' : 'text-texto-secundario'}>
                  {formatoDiaYHorario(fecha.inicio, fecha.fin)} — {{ en_vivo: 'En vivo', proxima: 'Próxima', finalizada: 'Finalizada', cancelada: 'Cancelada' }[fecha.estado]}
                </span>
                {fecha.estado === 'en_vivo' && (
                  <button type="button" onClick={() => ir('finalizar', [fecha])} className="inline-flex h-9 items-center gap-2 rounded-control border border-borde px-3 text-[12px] font-semibold text-accion hover:bg-fondo" aria-label={`Finalizar ahora ${formatoDiaYHorario(fecha.inicio, fecha.fin)}`}>
                    <CircleStop size={16} aria-hidden /> Finalizar ahora
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <hr className="border-borde" />
        <div className="flex flex-col gap-2">
          <AccionModal icono={<Pencil size={20} />} onClick={onEditar}>
            Editar
          </AccionModal>
          {/* PUBLICATION-4: una fecha próxima o en vivo */}
          <AccionModal variante="accion" icono={<CalendarX size={20} />} onClick={() => ir('cancelar', vigentes)}>
            Cancelar
          </AccionModal>
          {/* PUBLICATION-8 · decisión G-10: borra el evento completo */}
          <AccionModal variante="destructiva" icono={<Trash2 size={20} />} onClick={() => ir('eliminar')}>
            Eliminar
          </AccionModal>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-texto-secundario">Más acciones</p>
          <AccionModal icono={<CalendarPlus size={20} />} onClick={() => ir('anadir')}>
            Añadir fecha
          </AccionModal>
          {/* PUBLICATION-6 y PUBLICATION-7: solo con una fecha en vivo */}
          {enVivo.length > 0 && (
            <>
              <AccionModal icono={<CircleStop size={20} />} onClick={() => ir('finalizar', enVivo)}>
                Finalizar antes de tiempo
              </AccionModal>
              <AccionModal icono={<ClockPlus size={20} />} onClick={() => ir('extender', enVivo)}>
                Extender
              </AccionModal>
            </>
          )}
          {/* PUBLICATION-5: acción independiente, disponible mientras haya fechas próximas o en vivo */}
          {vigentes.length > 0 && (
            <AccionModal variante="accion" icono={<CalendarOff size={20} />} onClick={() => ir('cancelar-todas')}>
              Cancelar todas las fechas
            </AccionModal>
          )}
        </div>
      </>
    )
  } else {
    const pasos: Record<Exclude<Paso, 'menu'>, { texto: string; boton: string; variante: 'accion' | 'destructiva' | 'principal'; listo: boolean; hacer: () => Promise<{ error?: unknown; response: Response }>; campos?: ReactNode }> = {
      cancelar: {
        texto: 'Elige la sesión que quieres cancelar. Las demás sesiones no cambian.',
        boton: 'Cancelar sesión',
        variante: 'accion',
        listo: Boolean(elegida),
        hacer: () => api.POST('/api/fechas/{id}/cancelar/', ruta),
        campos: <ElegirFecha fechas={vigentes} elegida={elegida} onElegir={setElegida} />,
      },
      'cancelar-todas': {
        texto: 'Se cancelarán todas las sesiones próximas o en vivo. Las finalizadas no cambian y el evento pasará al historial.',
        boton: 'Cancelar todas las fechas',
        variante: 'accion',
        listo: true,
        hacer: () => api.POST('/api/eventos/{id}/cancelar-todas/', delEvento),
      },
      finalizar: {
        texto: 'La sesión en vivo terminará ahora, antes de la hora prevista.',
        boton: 'Finalizar ahora',
        variante: 'principal',
        listo: Boolean(elegida),
        hacer: () => api.POST('/api/fechas/{id}/finalizar/', ruta),
        campos: enVivo.length > 1 && <ElegirFecha fechas={enVivo} elegida={elegida} onElegir={setElegida} />,
      },
      extender: {
        texto: 'Elige la nueva hora de finalización de la sesión en vivo.',
        boton: 'Extender',
        variante: 'principal',
        listo: finValido,
        hacer: () => api.POST('/api/fechas/{id}/extender/', { ...ruta, body: { fin: localAIso(fin) } }),
        campos: (
          <>
            {enVivo.length > 1 && <ElegirFecha fechas={enVivo} elegida={elegida} onElegir={setElegida} />}
            <CampoTexto
              etiqueta="Nuevo fin"
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              error={fin && !finValido ? 'El nuevo fin debe ser posterior al fin actual.' : undefined}
            />
          </>
        ),
      },
      anadir: {
        texto: 'La nueva sesión se suma a las del evento con su propio horario.',
        boton: 'Añadir fecha',
        variante: 'principal',
        listo: Boolean(inicio && fin && fin > inicio),
        hacer: () => api.POST('/api/eventos/{id}/fechas/', { ...delEvento, body: { inicio: localAIso(inicio), fin: localAIso(fin) } }),
        campos: (
          <div className="grid gap-3 md:grid-cols-2">
            <CampoTexto etiqueta="Inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <CampoTexto
              etiqueta="Fin"
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              error={inicio && fin && fin <= inicio ? 'El fin debe ser posterior al inicio.' : undefined}
            />
          </div>
        ),
      },
      eliminar: {
        texto: `Se eliminará «${evento.nombre}» con todas sus sesiones. Esta acción no se puede deshacer.`,
        boton: 'Eliminar evento',
        variante: 'destructiva',
        listo: true,
        hacer: () => api.DELETE('/api/eventos/{id}/', delEvento),
      },
    }
    const actual = pasos[paso]
    contenido = (
      <>
        <p className="text-sm text-texto-secundario">{actual.texto}</p>
        {actual.campos}
        {errores.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-[13px] text-primario">
            {errores.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <AccionModal variante={actual.variante} disabled={!actual.listo || enviando} onClick={() => ejecutar(actual.hacer)}>
            {actual.boton}
          </AccionModal>
          <AccionModal icono={<ArrowLeft size={20} />} onClick={() => ir('menu')}>
            Volver
          </AccionModal>
        </div>
      </>
    )
  }

  return (
    <Modal titulo="Gestionar evento" onCerrar={onCerrar}>
      {contenido}
    </Modal>
  )
}