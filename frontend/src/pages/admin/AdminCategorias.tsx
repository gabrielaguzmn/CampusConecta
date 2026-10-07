import { useState } from 'react'
import { useCategoriasAdmin, useRefrescar } from '../../api/admin'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { AccionModal } from '../../components/AccionModal'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { Modal } from '../../components/Modal'
import { Cargando, Errores, Pildora, useAccion } from './comunes'

type Categoria = components['schemas']['Categoria']

// CATEGORY-1 · RF-023: crear, renombrar, activar o desactivar. El color lo elige el administrador (decisión G-54).
function FormularioCategoria({ categoria, onCerrar }: { categoria?: Categoria; onCerrar: () => void }) {
  const refrescar = useRefrescar()
  const { enviando, errores, ejecutar } = useAccion()
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [color, setColor] = useState(categoria?.color ?? '#950000')

  function guardar() {
    const cuerpo = { nombre: nombre.trim(), color: color.toUpperCase() }
    ejecutar(
      () =>
        categoria
          ? api.PATCH('/api/admin/categorias/{id}/', { params: { path: { id: categoria.id } }, body: cuerpo })
          : api.POST('/api/admin/categorias/', { body: cuerpo }),
      async () => (await refrescar(), onCerrar()),
    )
  }

  return (
    <Modal titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <CampoTexto etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div className="flex flex-col gap-2">
        <label htmlFor="color-categoria" className="text-sm font-semibold">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="color-categoria"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded-control border border-borde bg-superficie p-1"
          />
          <span className="text-sm text-texto-secundario">{color.toUpperCase()}</span>
        </div>
        <p className="text-[13px] text-texto-secundario">Se usa en los pines del mapa y en la franja de las tarjetas.</p>
      </div>
      <Errores mensajes={errores} />
      <AccionModal variante="principal" disabled={!nombre.trim() || enviando} onClick={guardar}>
        {categoria ? 'Guardar cambios' : 'Crear categoría'}
      </AccionModal>
    </Modal>
  )
}

function FilaCategoria({ categoria, onEditar }: { categoria: Categoria; onEditar: () => void }) {
  const refrescar = useRefrescar()
  const { enviando, errores, ejecutar } = useAccion()
  const activa = categoria.activa !== false
  return (
    <li className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-5 shadow-tarjeta md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ backgroundColor: categoria.color ?? undefined }} />
        <p className="font-semibold">{categoria.nombre}</p>
        <Pildora tono={activa ? 'ok' : 'neutro'}>{activa ? 'Activa' : 'Inactiva'}</Pildora>
      </div>
      <Errores mensajes={errores} />
      <div className="flex flex-col gap-2 md:w-[400px] md:flex-row">
        <AccionModal onClick={onEditar}>Editar</AccionModal>
        {/* CATEGORY-1 · criterio 3: la disponibilidad para nuevas publicaciones se ajusta (efecto sobre eventos existentes: G-29) */}
        <AccionModal
          variante={activa ? 'destructiva' : 'neutra'}
          disabled={enviando}
          onClick={() => ejecutar(() => api.PATCH('/api/admin/categorias/{id}/', { params: { path: { id: categoria.id } }, body: { activa: !activa } }), refrescar)}
        >
          {activa ? 'Desactivar' : 'Activar'}
        </AccionModal>
      </div>
    </li>
  )
}

export function AdminCategorias() {
  const categorias = useCategoriasAdmin()
  const [formulario, setFormulario] = useState<{ categoria?: Categoria }>()
  return (
    <section className="flex flex-col gap-6">
      <Boton onClick={() => setFormulario({})} className="w-full md:w-[180px]">
        Nueva categoría
      </Boton>
      <Cargando consulta={categorias} vacio={categorias.data?.length === 0}>
        <ul className="flex flex-col gap-4">
          {categorias.data?.map((c) => (
            <FilaCategoria key={c.id} categoria={c} onEditar={() => setFormulario({ categoria: c })} />
          ))}
        </ul>
      </Cargando>
      {formulario && <FormularioCategoria categoria={formulario.categoria} onCerrar={() => setFormulario(undefined)} />}
    </section>
  )
}
