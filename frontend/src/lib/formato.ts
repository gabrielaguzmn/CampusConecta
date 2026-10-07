// Formato de fechas de Figma: "17 Oct.", "03 Oct. · 15:00–17:00" (Figma 4:30135, 4:29131).
// Zona horaria America/Bogota (G-15).
const ZONA = 'America/Bogota'

// Figma solo muestra "Sep." y "Oct."; el resto sigue la misma regla: tres letras y punto.
const MESES = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.']

function partes(iso: string) {
  const valores = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const de = (tipo: Intl.DateTimeFormatPartTypes) => valores.find((p) => p.type === tipo)!.value
  return { dia: de('day').padStart(2, '0'), mes: Number(de('month')), hora: `${de('hour')}:${de('minute')}` }
}

export function formatoDia(iso: string): string {
  const { dia, mes } = partes(iso)
  return `${dia} ${MESES[mes - 1]}`
}

export function formatoHorario(inicio: string, fin: string): string {
  return `${partes(inicio).hora}–${partes(fin).hora}`
}

export function formatoDiaYHorario(inicio: string, fin: string): string {
  return `${formatoDia(inicio)} · ${formatoHorario(inicio, fin)}`
}
