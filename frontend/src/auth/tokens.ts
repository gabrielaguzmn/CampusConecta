// Sesión (docs/frontend/02_arquitectura.md §3, aprobado 2026-10-07):
// access solo en memoria; refresh en localStorage para sobrevivir a recargas.
const CLAVE_REFRESH = 'campusconecta.refresh'

let access: string | null = null
const oyentes = new Set<() => void>()

function leerRefresh(): string | null {
  try {
    return localStorage.getItem(CLAVE_REFRESH)
  } catch {
    return null
  }
}

export const tokens = {
  access: () => access,
  refresh: leerRefresh,
  guardar({ access: nuevo, refresh }: { access: string; refresh?: string }) {
    access = nuevo
    if (refresh) {
      try {
        localStorage.setItem(CLAVE_REFRESH, refresh)
      } catch {
        // Sin almacenamiento la sesión dura lo que la pestaña.
      }
    }
  },
  borrar() {
    access = null
    try {
      localStorage.removeItem(CLAVE_REFRESH)
    } catch {
      // nada que borrar
    }
    oyentes.forEach((oyente) => oyente())
  },
  /** Avisa cuando la sesión se cierra (logout o refresh rechazado). */
  alCerrarse(oyente: () => void) {
    oyentes.add(oyente)
    return () => {
      oyentes.delete(oyente)
    }
  },
}
