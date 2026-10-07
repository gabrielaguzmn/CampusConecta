import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, CalendarX, X } from 'lucide-react'
import { api, todosLosMensajes } from '../../api/client'
import { useCategorias, useUbicaciones } from '../../api/queries'
import type { components } from '../../api/schema'
import { AccionModal } from '../../components/AccionModal'
import { CampoSeleccion } from '../../components/CampoSeleccion'
import { CampoTexto } from '../../components/CampoTexto'
import { Modal } from '../../components/Modal'
import { formatoDia, isoALocal, localAIso } from '../../lib/formato'

type Evento = components['schemas']['Evento']

// PUBLICATION-1 · Figma 34:17 (Mobile) y 34:161 (Desktop). Campos de RF-008 y RF-010 tal cual (G-39).
// Respecto a Figma (G-09, G-43): «Ubicación» es el selector del catálogo (RF-009); «Ubicación exacta» es el detalle
// opcional (RF-010); se añaden «Responsable» y los opcionales; cada fecha pide inicio y fin (G-30, G-31);
// «Detalles» no se incluye porque sus dos ejemplos ya los cubren las fechas y la descripción.
const fecha = z
  .object({ id: z.number().optional(), inicio: z.string().min(1), fin: z.string().min(1) })
  .refine((f) => f.fin > f.inicio, { path: ['fin'], message: 'El fin debe ser posterior al inicio.' })

const esquema = z.object({
  nombre: z.string().trim().min(1),
  descripcion: z.string().trim().min(1),
  categoria: z.string().min(1),
  ubicacion: z.string().min(1),
  detalle_ubicacion: z.string(),
  responsable: z.string().trim().min(1),
  fechas: z.array(fecha).min(1),
  cupo: z.string().regex(/^([1-9]\d*)?$/, 'El cupo debe ser un número entero positivo.'),
  contacto: z.string(),
  enlace_externo: z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Introduce un enlace que empiece por http:// o https://.' })]),
})
type Datos = z.infer<typeof esquema>

const TIPOS_IMAGEN = ['image/jpeg', 'image/png']
const MAX_IMAGEN = 5 * 1024 * 1024 // G-07

function valoresIniciales(evento?: Evento): Datos {
  return {
    nombre: evento?.nombre ?? '',
    descripcion: evento?.descripcion ?? '',
    categoria: evento ? String(evento.categoria.id) : '',
    ubicacion: evento ? String(evento.ubicacion.id) : '',
    detalle_ubicacion: evento?.detalle_ubicacion ?? '',
    responsable: evento?.responsable ?? '',
    // Al editar solo se modifican las fechas próximas (PUBLICATION-3 · criterio 4).
    fechas: evento
      ? evento.fechas.filter((f) => f.estado === 'proxima').map((f) => ({ id: f.id, inicio: isoALocal(f.inicio), fin: isoALocal(f.fin) }))
      : [{ inicio: '', fin: '' }],
    cupo: evento?.cupo ? String(evento.cupo) : '',
    contacto: evento?.contacto ?? '',
    enlace_externo: evento?.enlace_externo ?? '',
  }
}

export function FormularioEvento({ evento, onCerrar }: { evento?: Evento; onCerrar: () => void }) {
  const editando = Boolean(evento)
  const cliente = useQueryClient()
  const categorias = useCategorias()
  const ubicaciones = useUbicaciones()
  const [imagen, setImagen] = useState<File>()
  const [errorImagen, setErrorImagen] = useState<string>()
  const [errores, setErrores] = useState<string[]>([])
  const { register, control, handleSubmit, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onChange',
    defaultValues: valoresIniciales(evento),
  })
  const fechas = useFieldArray({ control, name: 'fechas' })
  const { errors } = formState

  function elegirImagen(archivo?: File) {
    setErrorImagen(undefined)
    setImagen(undefined)
    if (!archivo) return
    if (!TIPOS_IMAGEN.includes(archivo.type) || archivo.size > MAX_IMAGEN) {
      setErrorImagen('La imagen debe ser JPG o PNG de 5 MB como máximo.')
      return
    }
    setImagen(archivo)
  }

  async function subirImagen(id: number) {
    if (!imagen) return []
    const { error } = await api.PUT('/api/eventos/{id}/imagen/', {
      params: { path: { id } },
      body: { imagen: imagen as unknown as string },
      bodySerializer: () => {
        const datos = new FormData()
        datos.append('imagen', imagen)
        return datos
      },
    })
    return error ? todosLosMensajes(error) : []
  }

  async function enviar(datos: Datos) {
    setErrores([])
    const comunes = {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      categoria: Number(datos.categoria),
      ubicacion: Number(datos.ubicacion),
      detalle_ubicacion: datos.detalle_ubicacion,
      responsable: datos.responsable,
      cupo: datos.cupo ? Number(datos.cupo) : null,
      contacto: datos.contacto,
      enlace_externo: datos.enlace_externo,
    }
    let id = evento?.id
    let mensajes: string[] = []
    if (!evento) {
      const { data, error } = await api.POST('/api/eventos/', {
        body: { ...comunes, fechas: datos.fechas.map((f) => ({ inicio: localAIso(f.inicio), fin: localAIso(f.fin) })) },
      })
      id = data?.id
      mensajes = todosLosMensajes(error)
    } else {
      const { error } = await api.PATCH('/api/eventos/{id}/', { params: { path: { id: evento.id } }, body: comunes })
      mensajes = todosLosMensajes(error)
      // PUBLICATION-3 · criterio 2: solo se envían las fechas que cambiaron; las demás no se tocan.
      for (const f of datos.fechas) {
        const original = evento.fechas.find((o) => o.id === f.id)
        if (!f.id || !original || (isoALocal(original.inicio) === f.inicio && isoALocal(original.fin) === f.fin)) continue
        const { error: errorFecha } = await api.PATCH('/api/fechas/{id}/', {
          params: { path: { id: f.id } },
          body: { inicio: localAIso(f.inicio), fin: localAIso(f.fin) },
        })
        mensajes.push(...todosLosMensajes(errorFecha))
      }
    }
    if (id && !mensajes.length) mensajes = await subirImagen(id)
    if (id) {
      // RNF-005: los cambios se ven en la siguiente consulta de Mis Eventos, el feed y el mapa.
      await Promise.all(['mis-eventos', 'eventos', 'mapa', 'evento'].map((clave) => cliente.invalidateQueries({ queryKey: [clave] })))
    }
    if (mensajes.length) setErrores(mensajes)
    else onCerrar()
  }

  return (
    <Modal titulo={editando ? 'Editar evento' : 'Crear evento'} onCerrar={onCerrar} className="p-6 md:p-8">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <CampoTexto etiqueta="Nombre del evento" placeholder="Ej. Taller de cerámica" {...register('nombre')} />
          <CampoTexto etiqueta="Descripción" multilinea placeholder="Describe el evento y qué incluye" {...register('descripcion')} />
          <CampoSeleccion etiqueta="Categoría" required {...register('categoria')}>
            <option value="" disabled>
              Selecciona una categoría
            </option>
            {categorias.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </CampoSeleccion>
          <CampoSeleccion etiqueta="Ubicación" required {...register('ubicacion')}>
            <option value="" disabled>
              Selecciona una ubicación del campus
            </option>
            {ubicaciones.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </CampoSeleccion>
          <CampoTexto etiqueta="Ubicación exacta (opcional)" placeholder="Ej. Sala de arte · Edificio C" {...register('detalle_ubicacion')} />
          <CampoTexto etiqueta="Responsable" placeholder="Persona o grupo que organiza" {...register('responsable')} />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{editando ? 'Sesiones próximas' : 'Fecha o fechas'}</legend>
            {fechas.fields.map((campo, i) => (
              <div key={campo.id} className="flex flex-col gap-2 rounded-control border border-borde p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-texto-secundario">
                    {editando && campo.id && evento ? `Sesión del ${formatoDia(localAIso(campo.inicio))}` : `Fecha ${i + 1}`}
                  </p>
                  {!editando && fechas.fields.length > 1 && (
                    <button type="button" onClick={() => fechas.remove(i)} aria-label={`Quitar fecha ${i + 1}`} className="flex size-8 items-center justify-center text-texto-secundario">
                      <X size={18} aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <CampoTexto etiqueta="Inicio" type="datetime-local" {...register(`fechas.${i}.inicio`)} />
                  <CampoTexto etiqueta="Fin" type="datetime-local" error={errors.fechas?.[i]?.fin?.message} {...register(`fechas.${i}.fin`)} />
                </div>
              </div>
            ))}
            {!editando && (
              <>
                <p className="text-[13px] text-texto-secundario">Puedes añadir una o varias sesiones.</p>
                <button type="button" onClick={() => fechas.append({ inicio: '', fin: '' })} className="flex h-8 items-center self-start px-4 text-sm text-primario">
                  + Añadir otra fecha
                </button>
              </>
            )}
          </fieldset>

          <CampoTexto etiqueta="Cupo (opcional)" inputMode="numeric" placeholder="Ej. 20" error={errors.cupo?.message} {...register('cupo')} />
          <CampoTexto etiqueta="Contacto (opcional)" placeholder="Correo, teléfono o red del organizador" {...register('contacto')} />
          <CampoTexto etiqueta="Enlace (opcional)" type="url" placeholder="https://" error={errors.enlace_externo?.message} {...register('enlace_externo')} />
          <CampoTexto
            etiqueta={editando && evento?.imagen ? 'Cambiar imagen (opcional)' : 'Imagen (opcional)'}
            type="file"
            accept="image/jpeg,image/png"
            error={errorImagen}
            onChange={(e) => elegirImagen(e.target.files?.[0])}
            className="[&_input]:py-3 [&_input]:file:mr-3 [&_input]:file:font-semibold [&_input]:file:text-primario"
          />
        </div>

        {errores.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-[13px] text-primario">
            {errores.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}

        <hr className="border-borde" />
        {/* Desktop (34:161): «Crear evento» y luego «Cancelar», con íconos. Mobile (34:17): al revés, sin íconos y de 44 px. */}
        <div className="flex flex-col-reverse gap-2 md:flex-col">
          <AccionModal
            type="submit"
            variante="principal"
            disabled={!formState.isValid || Boolean(errorImagen) || formState.isSubmitting}
            icono={<CalendarPlus size={20} className="hidden md:block" />}
            className="h-11 gap-0 md:h-13 md:gap-4"
          >
            {editando ? 'Guardar cambios' : 'Crear evento'}
          </AccionModal>
          <AccionModal onClick={onCerrar} icono={<CalendarX size={20} className="hidden md:block" />} className="h-11 gap-0 md:h-13 md:gap-4">
            Cancelar
          </AccionModal>
        </div>
      </form>
    </Modal>
  )
}
