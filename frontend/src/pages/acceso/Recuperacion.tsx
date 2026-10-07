import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { ArrowLeft, Mail } from 'lucide-react'
import { api, erroresDeCampo, mensajeDeError } from '../../api/client'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { ErrorFormulario, LayoutAcceso } from './LayoutAcceso'

const esquema = z.object({ email: z.email('Introduce un correo válido.') })
type Datos = z.infer<typeof esquema>

// ACCESS-1 · criterio 3 · Figma 4:28862 (Desktop), 4:29484 (Mobile). Enlace por correo válido 1 hora (G-17).
export function Recuperacion() {
  const [errorApi, setErrorApi] = useState<string>()
  const { register, handleSubmit, formState, setError } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onTouched' })

  async function enviar({ email }: Datos) {
    setErrorApi(undefined)
    const { error } = await api.POST('/api/auth/recuperacion/', { body: { email } })
    if (error) {
      const deCampo = erroresDeCampo(error)
      if (deCampo.email) setError('email', { message: deCampo.email })
      setErrorApi(mensajeDeError(error))
      return
    }
    // TODO(PENDIENTE G-57: confirmación en pantalla tras enviar el enlace; sin diseño)
  }

  return (
    <LayoutAcceso titulo="Recupera tu acceso" descripcion="Te ayudamos a volver a tu comunidad.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <p className="flex gap-3 rounded-control bg-fondo p-4 text-sm text-texto-secundario">
          <Mail size={20} aria-hidden className="shrink-0" />
          Introduce el correo de tu cuenta. Te enviaremos un enlace para restablecer tu contraseña.
        </p>
        <CampoTexto
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="tu.nombre@universidad.edu"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <ErrorFormulario mensaje={errorApi} />
        <Boton type="submit" disabled={!formState.isValid || formState.isSubmitting}>
          Enviar enlace de recuperación
        </Boton>
        <Link to="/login" className="flex h-11 items-center justify-center gap-2 text-sm font-semibold text-primario">
          <ArrowLeft size={18} aria-hidden />
          Volver a Login
        </Link>
      </form>
    </LayoutAcceso>
  )
}
