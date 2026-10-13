import { useState } from 'react'
import { useRefrescar, useUsuariosAdmin } from '../../api/admin'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { useSesion } from '../../auth/AuthProvider'
import { AccionModal } from '../../components/AccionModal'
import { Cargando, Errores, ModalMotivo, Pildora, useAccion } from './comunes'

type Usuario = components['schemas']['UsuarioAdmin']

// ADMIN-3 (RF-027, RF-033) y ADMIN-4 (RF-028). Límites sobre la propia cuenta o el último administrador: los decide la API (G-28).
function FilaUsuario({ usuario, esYo }: { usuario: Usuario; esYo: boolean }) {
  const refrescar = useRefrescar()
  const { enviando, errores, ejecutar } = useAccion()
  const [suspendiendo, setSuspendiendo] = useState(false)
  const ruta = { params: { path: { id: usuario.id } } }

  return (
    <li className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-5 shadow-tarjeta md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {usuario.nombre}
          {esYo && <span className="font-normal text-texto-secundario"> (tú)</span>}
        </p>
        <p className="text-[13px] text-texto-secundario">{usuario.email}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {usuario.es_administrador && <Pildora tono="ok">Administrador</Pildora>}
          {usuario.suspendida && <Pildora tono="alerta">Suspendida</Pildora>}
        </div>
        <Errores mensajes={errores} />
      </div>
      <div className="flex flex-col gap-2 md:w-[260px]">
        {usuario.suspendida ? (
          <AccionModal disabled={enviando} onClick={() => ejecutar(() => api.POST('/api/admin/usuarios/{id}/reactivar/', ruta), refrescar)}>
            Reactivar cuenta
          </AccionModal>
        ) : (
          <AccionModal variante="destructiva" disabled={esYo} onClick={() => setSuspendiendo(true)}>
            Suspender cuenta
          </AccionModal>
        )}
        {usuario.es_administrador ? (
          <AccionModal disabled={enviando} onClick={() => ejecutar(() => api.POST('/api/admin/usuarios/{id}/revocar-admin/', ruta), refrescar)}>
            Revocar administrador
          </AccionModal>
        ) : (
          <AccionModal disabled={enviando || usuario.suspendida} onClick={() => ejecutar(() => api.POST('/api/admin/usuarios/{id}/asignar-admin/', ruta), refrescar)}>
            Hacer administrador
          </AccionModal>
        )}
      </div>
      {suspendiendo && (
        <ModalMotivo
          titulo="Suspender cuenta"
          texto={`${usuario.nombre} no podrá iniciar sesión ni publicar, y sus fechas vigentes se ocultarán mientras dure la suspensión. Recibirá un correo con la norma incumplida.`}
          boton="Suspender cuenta"
          onCerrar={() => setSuspendiendo(false)}
          onConfirmar={async (motivo) => {
            const r = await api.POST('/api/admin/usuarios/{id}/suspender/', { ...ruta, body: motivo })
            if (r.response.ok) await refrescar()
            return r
          }}
        />
      )}
    </li>
  )
}

export function AdminUsuarios() {
  const usuarios = useUsuariosAdmin()
  const { usuario: yo } = useSesion()
  return (
    <Cargando consulta={usuarios} vacio={usuarios.data?.length === 0}>
      <ul className="flex flex-col gap-4">
        {usuarios.data?.map((u) => (
          <FilaUsuario key={u.id} usuario={u} esYo={u.id === yo?.id} />
        ))}
      </ul>
    </Cargando>
  )
}
