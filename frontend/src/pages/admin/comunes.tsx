import { useState, type ReactNode } from 'react'
import { todosLosMensajes } from '../../api/client'
import type { Norma } from '../../api/admin'
import { useNormas } from '../../api/queries'
import { AccionModal } from '../../components/AccionModal'
import { CampoSeleccion } from '../../components/CampoSeleccion'
import { CampoTexto } from '../../components/CampoTexto'
import { Modal } from '../../components/Modal'

// Módulo de administración: sin diseño en Figma (G-12), creado el 2026-10-07 con los patrones de 4:30135.

export function Pildora({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'alerta' | 'ok' | 'suave' }) {
  const tonos = {
    neutro: 'bg-fondo text-texto-secundario',
    alerta: 'bg-badge-cancelado text-destructivo',
    ok: 'bg-badge text-primario',
    suave: 'bg-badge text-accion',
  }
  return <span className={`inline-flex h-7 shrink-0 items-center rounded-pildora px-2.5 text-[13px] font-semibold ${tonos[tono]}`}>{children}</span>
}

export function Errores({ mensajes }: { mensajes: string[] }) {
  if (!mensajes.length) return null
  return (
    <ul role="alert" className="flex flex-col gap-1 text-[13px] text-primario">
      {mensajes.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  )
}

/** Ejecuta una acción de la API y devuelve sus mensajes de error. */
export function useAccion() {
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])
  async function ejecutar(accion: () => Promise<{ error?: unknown; response: Response }>, alTerminar?: () => unknown) {
    setEnviando(true)
    setErrores([])
    const { error, response } = await accion()
    setEnviando(false)
    if (!response.ok) {
      setErrores(todosLosMensajes(error))
      return false
    }
    await alTerminar?.()
    return true
  }
  return { enviando, errores, ejecutar }
}

// G-21: el motivo es una de las 10 normas de uso más un texto opcional. Se notifica por correo (RNF-007).
export function ModalMotivo({
  titulo,
  texto,
  boton,
  onConfirmar,
  onCerrar,
}: {
  titulo: string
  texto: string
  boton: string
  onConfirmar: (motivo: { norma: Norma; explicacion: string }) => Promise<{ error?: unknown; response: Response }>
  onCerrar: () => void
}) {
  const normas = useNormas()
  const [norma, setNorma] = useState('')
  const [explicacion, setExplicacion] = useState('')
  const { enviando, errores, ejecutar } = useAccion()
  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <p className="text-sm text-texto-secundario">{texto}</p>
      <CampoSeleccion etiqueta="Norma incumplida" required value={norma} onChange={(e) => setNorma(e.target.value)}>
        <option value="" disabled>
          Selecciona una norma
        </option>
        {normas.data?.map((n) => (
          <option key={n.id} value={n.id}>
            {n.id}. {n.nombre}
          </option>
        ))}
      </CampoSeleccion>
      <CampoTexto etiqueta="Explicación (opcional)" multilinea value={explicacion} onChange={(e) => setExplicacion(e.target.value)} />
      <Errores mensajes={errores} />
      <AccionModal
        variante="principal"
        disabled={!norma || enviando}
        onClick={() => ejecutar(() => onConfirmar({ norma: Number(norma) as Norma, explicacion }), onCerrar)}
      >
        {boton}
      </AccionModal>
    </Modal>
  )
}

export function Cargando({ consulta, vacio, children }: { consulta: { isPending: boolean; isError: boolean; refetch: () => unknown }; vacio: boolean; children: ReactNode }) {
  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando" className="h-40 animate-pulse rounded-tarjeta bg-borde" />
  if (consulta.isError)
    return (
      <p role="alert" className="text-sm text-texto-secundario">
        No pudimos cargar la información.{' '}
        <button type="button" onClick={() => consulta.refetch()} className="font-semibold text-primario">
          Intenta de nuevo.
        </button>
      </p>
    )
  if (vacio) return <p className="text-sm text-texto-secundario">No hay elementos para mostrar.</p>
  return <>{children}</>
}
