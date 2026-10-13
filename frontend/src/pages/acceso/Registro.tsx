import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { api, erroresDeCampo, mensajeDeError } from '../../api/client'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/CampoTexto'
import { ErrorFormulario, LayoutAcceso } from './LayoutAcceso'

// G-08: nombre obligatorio y "Confirmar Contraseña" validado en el frontend (decisión 2026-10-07).
// TODO(PENDIENTE G-57: texto cuando las contraseñas no coinciden; mientras tanto el botón queda deshabilitado)
const esquema = z
  .object({
    nombre: z.string().trim().min(1),
    email: z.email('Introduce un correo válido.'),
    password: z.string().min(1),
    confirmar: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmar, { path: ['confirmar'] })
type Datos = z.infer<typeof esquema>

// ACCESS-1 · criterio 1 · Figma 4:28815 (Desktop), 4:29448 (Mobile)
export function Registro() {
  const navegar = useNavigate()
  const [errorApi, setErrorApi] = useState<string>()
  const { register, handleSubmit, formState, setError } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onTouched' })
  const { errors } = formState

  async function enviar({ nombre, email, password }: Datos) {
    setErrorApi(undefined)
    const { error } = await api.POST('/api/auth/registro/', { body: { nombre, email, password } })
    if (error) {
      // Errores de la API: "Ya existe una cuenta con este correo." (`email`) y la política de contraseña (`password`, G-35).
      for (const [campo, mensaje] of Object.entries(erroresDeCampo(error))) {
        if (campo === 'nombre' || campo === 'email' || campo === 'password') setError(campo, { message: mensaje })
      }
      setErrorApi(mensajeDeError(error))
      return
    }
    // ACCESS-1 · criterio 1: la cuenta queda disponible sin confirmación por enlace.
    // TODO(PENDIENTE G-57: qué ocurre tras registrarse; por ahora se vuelve a Login, pantalla existente)
    navegar('/login', { replace: true })
  }

  return (
    <LayoutAcceso titulo="Crea tu cuenta" descripcion="Forma parte de la comunidad CampusConecta.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <CampoTexto etiqueta="Nombre" autoComplete="name" placeholder="Tu nombre completo" error={errors.nombre?.message} {...register('nombre')} />
          <CampoTexto
            etiqueta="Correo"
            type="email"
            autoComplete="email"
            placeholder="tu.nombre@universidad.edu"
            error={errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            etiqueta="Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Crea una contraseña"
            error={errors.password?.message}
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
        {/* TODO(PENDIENTE G-08: casilla "Acepto las normas de uso"; obligatoriedad y envío a la API sin definir) */}
        <ErrorFormulario mensaje={errorApi} />
        <Boton type="submit" disabled={!formState.isValid || formState.isSubmitting}>
          Registrarse
        </Boton>
        <Link to="/login" className="text-center text-sm font-semibold text-primario">
          ¿Ya tienes cuenta? Iniciar Sesión
        </Link>
      </form>
    </LayoutAcceso>
  )
}
