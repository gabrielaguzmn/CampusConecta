import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router'
import { api, erroresDeCampo, mensajeDeError } from '../../api/client'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { ErrorFormulario, LayoutAcceso } from './LayoutAcceso'

// Pantalla sin diseño en Figma (G-49, G-12), creada el 2026-10-07 con el estilo de Recuperación (4:28862).
// El correo de recuperación enlaza aquí con ?uid=&token= (G-17: válido 1 hora, un solo uso).
const esquema = z
  .object({ password: z.string().min(1), confirmar: z.string().min(1) })
  .refine((d) => d.password === d.confirmar, { path: ['confirmar'] })
type Datos = z.infer<typeof esquema>

export function NuevaContrasena() {
  const [parametros] = useSearchParams()
  const uid = parametros.get('uid') ?? ''
  const token = parametros.get('token') ?? ''
  const [lista, setLista] = useState(false)
  const [errorApi, setErrorApi] = useState<string>()
  const { register, handleSubmit, formState, setError } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onTouched' })

  async function enviar({ password }: Datos) {
    setErrorApi(undefined)
    const { error, response } = await api.POST('/api/auth/recuperacion/confirmar/', { body: { uid, token, password } })
    if (response.ok) return setLista(true)
    const deCampo = erroresDeCampo(error)
    if (deCampo.password) setError('password', { message: deCampo.password })
    // "El enlace no es válido o ha caducado." llega en non_field_errors
    setErrorApi(deCampo.non_field_errors ?? deCampo.uid ?? deCampo.token ?? mensajeDeError(error))
  }

  if (lista) {
    return (
      <LayoutAcceso titulo="Contraseña actualizada" descripcion="Ya puedes iniciar sesión con tu nueva contraseña.">
        <Link to="/login" className="flex h-12 items-center justify-center rounded-control bg-accion text-sm font-semibold text-white hover:bg-primario">
          Iniciar Sesión
        </Link>
      </LayoutAcceso>
    )
  }

  return (
    <LayoutAcceso titulo="Crea una nueva contraseña" descripcion="Elige una contraseña para volver a tu comunidad.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <CampoTexto
            etiqueta="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Crea una contraseña"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <CampoTexto
            etiqueta="Confirmar Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            {...register('confirmar')}
          />
        </div>
        <ErrorFormulario mensaje={errorApi} />
        <Boton type="submit" disabled={!uid || !token || !formState.isValid || formState.isSubmitting}>
          Guardar contraseña
        </Boton>
        <Link to="/recuperar" className="text-center text-sm font-semibold text-primario">
          Pedir un enlace nuevo
        </Link>
      </form>
    </LayoutAcceso>
  )
}
