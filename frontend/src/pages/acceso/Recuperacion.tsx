import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { ArrowLeft, Mail } from 'lucide-react'
import { api, erroresDeCampo, mensajeDeError, todosLosMensajes } from '../../api/client'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { Toast } from '../../components/Toast'
import { LayoutAcceso } from './LayoutAcceso'

const esquema = z.object({ email: z.email('Introduce un correo válido.') })
type Datos = z.infer<typeof esquema>

// ACCESS-1 · criterio 3 · Figma 4:28862 (Desktop), 4:29484 (Mobile). Enlace por correo válido 1 hora (G-17).
export function Recuperacion() {
  const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string }>()
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onTouched' })

  async function enviar({ email }: Datos) {
    const { error } = await api.POST('/api/auth/recuperacion/', { body: { email } })
    if (error) {
      const deCampo = erroresDeCampo(error)
      const datosError = error as { codes?: { email?: string | string[] } }
      const codigo = Array.isArray(datosError.codes?.email) ? datosError.codes.email[0] : datosError.codes?.email
      const mensajePorCodigo: Record<string, string> = {
        correo_no_registrado: 'La cuenta no está registrada.',
        cuenta_suspendida: 'La cuenta está suspendida. No puedes recuperar la contraseña mientras esté suspendida.',
      }
      const mensaje =
        deCampo.email ??
        mensajeDeError(error) ??
        (codigo ? mensajePorCodigo[codigo] : undefined) ??
        todosLosMensajes(error)[0] ??
        'No fue posible enviar el correo de recuperación.'
      setToast({ tipo: 'error', mensaje })
      return
    }
    setToast({ tipo: 'exito', mensaje: 'Enlace de recuperación enviado. Revisa tu correo.' })
  }

  return (
    <>
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
        <Boton type="submit" disabled={!formState.isValid || formState.isSubmitting}>
          Enviar enlace de recuperación
        </Boton>
        <Link to="/login" className="flex h-11 items-center justify-center gap-2 text-sm font-semibold text-primario">
          <ArrowLeft size={18} aria-hidden />
          Volver a Login
        </Link>
        </form>
      </LayoutAcceso>
      {toast && <Toast tipo={toast.tipo} mensaje={toast.mensaje} cerrar={() => setToast(undefined)} />}
    </>
  )
}
