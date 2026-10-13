// Figma 4:30135 · Pines de mapa (5:21–5:22):
// "Un pin por evento. El seleccionado añade un halo visible, sin duplicar las sesiones."
// El color de la categoría llegará de la API (CONTRATO-01, decisión G-54).
export function PinMapa({ color, seleccionado = false }: { color: string; seleccionado?: boolean }) {
  const y = seleccionado ? 3 : 8
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" aria-hidden data-seleccionado={seleccionado}>
      {seleccionado && <circle cx="24" cy="24" r="23" fill="rgb(226 0 0 / 0.1)" stroke="#E20000" strokeWidth="2" />}
      <path
        transform={`translate(8 ${y})`}
        d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0Z"
        fill={color}
      />
      <circle cx="24" cy={y + 16} r="6" fill="#FFFFFF" />
    </svg>
  )
}
