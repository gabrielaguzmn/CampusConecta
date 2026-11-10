export type CatalogItem = { id: number; nombre: string }

export type VoiceCommand = {
  fields: Partial<Record<'nombre' | 'descripcion' | 'responsable' | 'detalle_ubicacion' | 'cupo' | 'contacto' | 'enlace_externo', string>>
  categoria?: number
  ubicacion?: number
  ambiguousUbicaciones?: CatalogItem[]
  date?: { inicio: string; fin: string }
  dates?: { inicio: string; fin: string }[]
  crearEvento?: boolean
  messages: string[]
}

const sinAcentos = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function valorDespuesDe(texto: string, nombres: string[]) {
  const etiquetas = [
    'nombre(?:\\s+(?:del|de la)\\s+evento)?',
    'titulo(?:\\s+(?:del|de la)\\s+evento)?',
    'descripcion',
    'descripción',
    'responsable',
    'responsable(?:\\s+del\\s+evento)?',
    'organiza',
    'organizado\\s+por',
    'organizada\\s+por',
    'ubicacion(?:\\s+(?:exacta|del campus))?',
    'ubicación(?:\\s+(?:exacta|del campus))?',
    'lugar',
    'categoria',
    'categoría',
    'categor(?:i|í)a',
    'fecha(?:s)?',
    'horario',
    'cupo(?:\\s+m[aá]ximo)?',
    'contacto',
    'mi\\s+contacto',
  ]
  const patron = new RegExp(
    `(?:${nombres.join('|')})(?:\\s+(?:del|de la)\\s+(?:evento|campus))?\\b[\\s,·]*(?:es|son|de|a|:)?[\\s,·]*(.+?)(?=\\s*(?:[.;·]|\\b(?:y\\s+)?(?:${etiquetas.join('|')})\\b\\s*(?:es|son|de|a|:)?|$))`,
    'i',
  )
  return patron
    .exec(texto)?.[1]
    ?.trim()
    .replace(/[.,;]$/, '')
    .replace(/^(?:(?:es|son)\s+)+/i, '')
    .replace(/^(?:el|la|los|las)\s+/i, '')
}

function limpiarValorCatalogo(valor: string) {
  return sinAcentos(valor)
    .replace(/^(?:(?:en|a|de)\s+)?(?:el|la|los|las)\s+/i, '')
    .replace(/^(?:en|a|de)\s+/i, '')
    .replace(/\b([a-z])\s+(\d+)\b/gi, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function catalogoMencionado(texto: string, catalogo: CatalogItem[]) {
  const textoNormalizado = limpiarValorCatalogo(texto)
  const codigosMencionados = [...textoNormalizado.matchAll(/\b([a-z])\s*(\d{1,2})\b/gi)].map((coincidencia) => `${coincidencia[1]}${coincidencia[2]}`)
  return catalogo.filter((item) => {
    const nombre = limpiarValorCatalogo(item.nombre)
    const nombreSinEdificio = nombre.replace(/^edificios?\s+/, '')
    const nombreCompacto = nombreSinEdificio.replace(/\s+/g, '')
    const textoCompacto = textoNormalizado.replace(/\s+/g, '')
    const esCodigoEdificio = /^[a-z]\d+$/i.test(nombreSinEdificio)
    return (
      nombre.length > 0 &&
      (esCodigoEdificio
        ? codigosMencionados.includes(nombreCompacto.toLowerCase())
        : textoNormalizado.includes(nombre) ||
        nombre.includes(textoNormalizado) ||
        textoNormalizado.includes(nombreSinEdificio) ||
        textoCompacto.includes(nombreCompacto))
    )
  })
}

function contactoDicho(texto: string) {
  const coincidencia = texto.match(
    /(?:numero\s+de\s+contacto|número\s+de\s+contacto|datos\s+de\s+contacto|mi\s+contacto|el\s+contacto|contacto)\b[\s,]*(?:es|son|de|:)?[\s,]*(?:el\s+)?(?:numero|número)?[\s,]*(\d[\d\s-]*\d|\d)/i,
  )
  if (!coincidencia) return undefined
  const numero = coincidencia[1].replace(/[^\d]/g, '')
  return numero.length >= 3 ? numero : undefined
}

function nombreDicho(texto: string) {
  const coincidencia = texto.match(
    /(?:el\s+)?(?:nombre\s+del\s+evento|nombre\s+del\s+evento|t[ií]tulo\s+del\s+evento|nombre|t[ií]tulo)\s*(?:es|son|:)\s*(.+?)(?=\s*(?:[.;·]|$))/i,
  )
  return coincidencia?.[1]?.trim()
}

function valorEtiquetado(texto: string, etiqueta: string) {
  const coincidencia = texto.match(new RegExp(`(?:${etiqueta})\\s*(?:es|son|:)?\\s*(.+?)(?=\\s*(?:[.;·]|$))`, 'i'))
  return coincidencia?.[1]?.trim()
}

function numeroHablado(valor: string) {
  const coincidencia = valor.match(/\b(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i)
  if (!coincidencia) return undefined
  const palabras: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }
  return Number(coincidencia[1]) || palabras[sinAcentos(coincidencia[1])]
}

function fechaHablada(texto: string): VoiceCommand['date'] {
  const ahora = new Date()
  const manana = /\bmanana\b/i.test(sinAcentos(texto))
  const patronFecha = /\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+del?\s+(\d{4}))?/gi
  const fechas = [...texto.matchAll(patronFecha)]
  const dia = fechas[0]
  if (!manana && !dia) return undefined
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const convertirFecha = (coincidencia: RegExpMatchArray, base: Date) => {
    const fecha = new Date(base)
    fecha.setFullYear(Number(coincidencia[3] ?? base.getFullYear()))
    fecha.setMonth(meses.indexOf(sinAcentos(coincidencia[2])), Number(coincidencia[1]))
    return fecha
  }
  const inicio = manana ? new Date(ahora.setDate(ahora.getDate() + 1)) : convertirFecha(dia!, ahora)
  const segundaFecha = fechas[1]
  const textoHorario = texto.slice((dia?.index ?? 0) + (dia?.[0].length ?? 0))
  const horasConPeriodo = [...textoHorario.matchAll(/(?:a\s+(?:las?|la)\s+|de\s+)?(una|uno|\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+)?(mañana|tarde|noche|am|pm)\b/gi)]
  const horasSinPeriodo = [...textoHorario.matchAll(/a\s+(?:las?|la)\s+(una|uno|\d{1,2})(?::(\d{2}))?\b/gi)]
  const horas = horasConPeriodo.length
    ? horasConPeriodo.map((hora) => ({ 1: hora[1], 2: hora[2], 3: hora[3] }))
    : horasSinPeriodo.map((hora) => ({ 1: hora[1], 2: hora[2], 3: undefined }))
  const horasUsadas = horas.length
    ? horas
    : [{ 1: '9', 2: undefined, 3: 'am' }, { 1: '11', 2: undefined, 3: 'am' }]
  const periodoGeneral = texto.match(/de\s+la\s+(mañana|tarde|noche)/i)?.[1]
  const convertir = (coincidencia: { 1?: string; 2?: string; 3?: string }) => {
    let hora = numeroHablado(coincidencia[1] ?? '') ?? 0
    const minuto = Number(coincidencia[2] ?? 0)
    if (/tarde|noche|pm/i.test(coincidencia[3] ?? periodoGeneral ?? '') && hora < 12) hora += 12
    return { hora, minuto }
  }
  const comienzo = convertir(horasUsadas[0])
  const indicaFin = /\b(?:hasta|finaliza|finaliza el|termina|terminando)\b/i.test(textoHorario)
  let fin = horasUsadas[1] && indicaFin ? convertir(horasUsadas[1]) : { hora: comienzo.hora + 2, minuto: comienzo.minuto }
  const fechaFin = segundaFecha ? convertirFecha(segundaFecha, inicio) : inicio
  const iso = (valor: Date, hora: number, minuto: number) => {
    const fecha = new Date(valor)
    fecha.setHours(hora, minuto, 0, 0)
    const pad = (numero: number) => String(numero).padStart(2, '0')
    return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
  }
  if (fin.hora >= 24) fin = { hora: fin.hora - 24, minuto: fin.minuto }
  return { inicio: iso(inicio, comienzo.hora, comienzo.minuto), fin: iso(fechaFin, fin.hora, fin.minuto) }
}

export function interpretarVoz(texto: string, categorias: CatalogItem[], ubicaciones: CatalogItem[]): VoiceCommand {
  const fields: VoiceCommand['fields'] = {}
  const messages: string[] = []
  const crearEvento = /\b(?:crear|crea|publicar|publica)\s+(?:el\s+)?evento\b/i.test(texto)
  let categoria: number | undefined
  let ubicacion: number | undefined
  const definiciones: Array<[keyof VoiceCommand['fields'], string[]]> = [
    ['nombre', ['nombre', 'titulo', 'título', 'nombre del evento', 'título del evento']],
    ['descripcion', ['descripcion', 'descripción', 'detalle', 'información del evento']],
    ['responsable', ['responsable', 'responsables', 'organiza', 'organizado por', 'organizada por']],
    ['detalle_ubicacion', ['ubicacion exacta', 'ubicación exacta', 'detalle de ubicacion', 'detalle de ubicación']],
    ['cupo', ['cupo', 'cupo máximo', 'cupo maximo', 'capacidad']],
    ['contacto', ['contacto', 'mi contacto', 'datos de contacto']],
    ['enlace_externo', ['enlace', 'link']],
  ]
  for (const [campo, nombres] of definiciones) {
    const valor = valorDespuesDe(texto, nombres)
    if (valor) fields[campo] = valor
  }
  const nombre = nombreDicho(texto)
  if (nombre) fields.nombre = nombre
  const contacto = contactoDicho(texto)
  if (contacto) fields.contacto = contacto
  const descripcion = valorEtiquetado(texto, 'descripci[oó]n')
  if (descripcion) fields.descripcion = descripcion
  const ubicacionExacta = valorEtiquetado(texto, 'ubicaci[oó]n\\s+exacta')
  if (ubicacionExacta) fields.detalle_ubicacion = ubicacionExacta
  if (fields.cupo) {
    const cupo = numeroHablado(fields.cupo)
    if (!cupo || cupo <= 0) {
      delete fields.cupo
      messages.push('El cupo debe ser un número entero positivo.')
    } else {
      fields.cupo = String(cupo)
    }
  }

  const categoriaDicha = valorDespuesDe(texto, ['categoria', 'categoría'])
  if (categoriaDicha) {
    const valor = limpiarValorCatalogo(categoriaDicha)
    const coincidencias = categorias.filter((item) => {
      const nombre = limpiarValorCatalogo(item.nombre)
      return nombre === valor || nombre.includes(valor) || valor.includes(nombre)
    })
    if (coincidencias.length === 1) messages.push(`Categoría completada: ${coincidencias[0].nombre}.`)
    else messages.push('No encontré una categoría activa en el catálogo.')
    if (coincidencias.length === 1) categoria = coincidencias[0].id
  }
  if (!categoria) {
    const categoriasMencionadas = catalogoMencionado(texto, categorias)
    if (categoriasMencionadas.length === 1) {
      categoria = categoriasMencionadas[0].id
      messages.push(`Categoría completada: ${categoriasMencionadas[0].nombre}.`)
    }
  }
  const ubicacionDicha = valorDespuesDe(texto, ['ubicacion', 'ubicación', 'lugar'])
  if (ubicacionDicha) {
    const segmentos = [...texto.matchAll(/(?:ubicacion|ubicación|lugar)(?:\s+exacta)?[\s,·]*(?:es|son|de|a|:)?\s*(.*?)(?=\s*(?:[.;]|(?:ubicacion|ubicación|lugar|responsable|categoria|categoría|fecha|cupo|contacto)\b|$))/gi)]
      .map((coincidencia) => coincidencia[1].trim())
      .filter(Boolean)
    const valor = limpiarValorCatalogo(segmentos.at(-1) ?? ubicacionDicha)
    const coincidencias = ubicaciones.filter((item) => {
      const nombre = limpiarValorCatalogo(item.nombre)
      return nombre.includes(valor) || valor.includes(nombre) || sinAcentos(valor).includes(nombre)
    })
    const coincidenciasEnSegmentos = ubicaciones.filter((item) =>
      segmentos.at(-1) && limpiarValorCatalogo(segmentos.at(-1)!).includes(limpiarValorCatalogo(item.nombre)),
    )
    const coincidenciasFinales = coincidenciasEnSegmentos.length ? coincidenciasEnSegmentos : coincidencias
    if (coincidenciasFinales.length === 1) {
      ubicacion = coincidenciasFinales[0].id
      messages.push(`Ubicación completada: ${coincidenciasFinales[0].nombre}.`)
    }
    if (coincidenciasFinales.length > 1) return { fields, ambiguousUbicaciones: coincidenciasFinales, date: fechaHablada(texto), messages: [...messages, 'Encontré varias ubicaciones; elige una.'] }
    if (!coincidenciasFinales.length) messages.push('La ubicación no está en el catálogo vigente.')
  }
  if (!ubicacion) {
    const ubicacionesMencionadas = catalogoMencionado(texto, ubicaciones)
    if (ubicacionesMencionadas.length === 1) {
      ubicacion = ubicacionesMencionadas[0].id
      messages.push(`Ubicación completada: ${ubicacionesMencionadas[0].nombre}.`)
    } else if (ubicacionesMencionadas.length > 1) {
      return {
        fields,
        categoria,
        ambiguousUbicaciones: ubicacionesMencionadas,
        date: fechaHablada(texto),
        messages: [...messages, 'Encontré varias ubicaciones; elige una.'],
      }
    }
  }
  const fechas = texto.split(/\bsegunda\s+fecha\b/i).map(fechaHablada).filter((fecha): fecha is { inicio: string; fin: string } => Boolean(fecha))
  const date = fechas[0]
  if (fechas.length) messages.push(`${fechas.length} fecha${fechas.length === 1 ? '' : 's'} y horario${fechas.length === 1 ? '' : 's'} completados.`)
  else if (/\bfecha(?:s)?\b/i.test(texto)) {
    messages.push('No agregué la fecha: indica también la hora de inicio y de fin, y usa una fecha futura.')
  }
  if (!Object.keys(fields).length && !categoriaDicha && !ubicacionDicha && !date) messages.push('No entendí un campo. Puedes decir nombre, descripción, responsable, ubicación, cupo, contacto, enlace o fecha.')
  return { fields, categoria, ubicacion, date, dates: fechas, crearEvento, messages }
}
