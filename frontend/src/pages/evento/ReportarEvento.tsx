import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, mensajeDeError } from '../../api/client'
import type { components } from '../../api/schema'
import { useNormas } from '../../api/queries'
import { Boton } from '../../components/Boton'
import { CampoSeleccion } from '../../components/CampoSeleccion'
import { CampoTexto } from '../../components/CampoTexto'
import { Modal } from '../../components/Modal'

// Pantalla sin diseño en Figma (G-12), creada el 2026-10-07 con el estilo del modal de gestión.
// DISPLAY-3 · RF-007: causa obligatoria (una norma de uso, G-20) y detalles opcionales.
const esquema = z.object({ causa: z.coerce.number().int().min(1), detalles: z.string() })
type Entrada = z.input<typeof esquema>
type Datos = z.output<typeof esquema>

export function ReportarEvento({ eventoId, onCerrar }: { eventoId: number; onCerrar: () => void }) {
  const normas = useNormas()
  const [confirmacion, setConfirmacion] = useState<string>()
  const [errorApi, setErrorApi] = useState<string>()
  const { register, handleSubmit, formState } = useForm<Entrada, unknown, Datos>({
    resolver: zodResolver(esquema),
    mode: 'onChange',
    defaultValues: { causa: '', detalles: '' },
  })

  async function enviar({ causa, detalles }: Datos) {
    setErrorApi(undefined)
    const { data, error } = await api.POST('/api/eventos/{id}/reportes/', {
      params: { path: { id: eventoId } },
      body: { causa: causa as components['schemas']['NormaEnum'], detalles },
    })
    if (data) setConfirmacion(data.detail)
    else setErrorApi(mensajeDeError(error))
  }

  if (confirmacion) {
    // RF-030: solo se confirma el envío, sin seguimiento. El texto viene de la API.
    return (
      <Modal titulo="Reporte enviado" onCerrar={onCerrar}>
        <p className="text-sm text-texto-secundario">{confirmacion}</p>
        <Boton onClick={onCerrar}>Entendido</Boton>
      </Modal>
    )
  }

  return (
    <Modal titulo="Reportar evento" onCerrar={onCerrar}>
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <p className="text-sm text-texto-secundario">Indica qué norma de uso incumple este evento.</p>
        <CampoSeleccion etiqueta="Causa" required {...register('causa')}>
          <option value="" disabled>
            Selecciona una norma
          </option>
          {normas.data?.map((n) => (
            <option key={n.id} value={n.id}>
              {n.id}. {n.nombre}
            </option>
          ))}
        </CampoSeleccion>
        <CampoTexto etiqueta="Detalles (opcional)" multilinea placeholder="Cuéntanos más, si quieres" {...register('detalles')} />
        {errorApi && (
          <p role="alert" className="text-[13px] text-primario">
            {errorApi}
          </p>
        )}
        <Boton type="submit" disabled={!formState.isValid || formState.isSubmitting}>
          Enviar reporte
        </Boton>
      </form>
    </Modal>
  )
}
