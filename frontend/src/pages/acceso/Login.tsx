import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router'
import { mensajeDeError } from '../../api/client'
import { useSesion } from '../../auth/AuthProvider'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { ErrorFormulario, LayoutAcceso } from './LayoutAcceso'

// Mensaje de Figma 4:30135 · Input / Error. Campo vacío: sin texto en Figma (G-57), el botón queda deshabilitado.
const esquema = z.object({
  email: z.email('Introduce un correo válido.'),
  password: z.string().min(1),
})
type Datos = z.infer<typeof esquema>

// ACCESS-1 · criterio 2 · Figma 4:28777 (Desktop), 4:29421 (Mobile)
export function Login() {
  const { iniciarSesion } = useSesion()
  const navegar = useNavigate()
  const destino = (useLocation().state as { desde?: string } | null)?.desde ?? '/feed'
  const [errorApi, setErrorApi] = useState<string>()
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onTouched' })

  async function enviar({ email, password }: Datos) {
    setErrorApi(undefined)
    try {
      await iniciarSesion(email, password)
      navegar(destino, { replace: true })
    } catch (error) {
      // Credenciales inválidas (`no_active_account`) o cuenta suspendida (`cuenta_suspendida`, RF-033): texto de la API.
      // TODO(PENDIENTE G-50: texto para errores de red sin respuesta de la API)
      setErrorApi(mensajeDeError(error))
    }
  }

  return (
    <LayoutAcceso titulo="Bienvenido de nuevo" descripcion="Inicia sesión y descubre lo que pasa en tu campus.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <CampoTexto
            etiqueta="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="tu.nombre@universidad.edu"
            error={formState.errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="Introduce tu contraseña"
            {...register('password')}
          />
          <Link to="/recuperar" className="self-end text-sm font-semibold text-primario">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <ErrorFormulario mensaje={errorApi} />
        <Boton type="submit" disabled={!formState.isValid || formState.isSubmitting}>
          Iniciar Sesión
        </Boton>
        <p className="flex flex-col items-center gap-2 text-sm">
          <span className="text-texto-secundario">¿Aún no tienes una cuenta?</span>
          <Link to="/registro" className="font-semibold text-primario">
            Regístrate aquí
          </Link>
        </p>
      </form>
    </LayoutAcceso>
  )
}
