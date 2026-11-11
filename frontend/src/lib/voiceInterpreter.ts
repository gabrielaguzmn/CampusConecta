// Interpretador por reglas del asistente de voz guiado (VOICE-3 a VOICE-5). El asistente pregunta un campo a la vez;
// esta función recibe la respuesta ya transcrita por Deepgram y la convierte en el valor de ese campo.
// No inventa datos: si falta algo, no lo completa y lo pide.

export type CatalogItem = { id: number; nombre: string }

export type CampoTexto = 'nombre' | 'descripcion' | 'responsable' | 'detalle_ubicacion' | 'cupo' | 'contacto' | 'enlace_externo'

type Campo = CampoTexto | 'categoria' | 'ubicacion' | 'fecha'

// Normaliza carácter por carácter para que los índices coincidan con el texto original.
const normalizar = (texto: string) =>
  [...texto]
    .map((c) => {
      const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      return base.length === 1 ? base : c.toLowerCase()
    })
    .join('')

const sinAcentos = (valor: string) => valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Etiquetas por campo (sin tildes). El orden importa: las más largas primero.
const ETIQUETAS: Array<[Campo, string, boolean]> = [
  // [campo, patrón, admite valor sin conector («Organiza Club de ciencia»)]
  ['detalle_ubicacion', 'ubicacion exacta|detalle de (?:la )?ubicacion|lugar exacto', false],
  ['nombre', '(?:nombre|titulo)(?: del evento)?', false],
  ['descripcion', 'descripcion(?: del evento)?', false],
  ['responsable', 'organizado por|organizada por', true],
  ['responsable', 'responsables?(?: del evento)?|organizador(?:a|es)?', false],
  ['responsable', 'organiza', true],
  ['categoria', 'categoria(?: del evento)?|tipo de evento', false],
  ['ubicacion', 'ubicacion(?: del evento)?|lugar(?: del evento)?', false],
  ['cupo', 'cupo(?: maximo)?|capacidad(?: maxima)?|aforo', false],
  ['contacto', '(?:numero|datos|correo|telefono) de contacto|contacto|telefono|celular|correo(?: electronico)?', false],
  ['enlace_externo', 'enlace(?: externo)?|link|url|pagina web', false],
  ['fecha', '(?:(?:la )?(?:primera|segunda|tercera|otra|nueva) )?fechas?(?: del evento)?|horario', true],
]

// Una etiqueta cuenta solo al inicio, tras puntuación o tras «y»; así «el nombre de las estrellas» dentro de una
// descripción no se toma como otro campo.
const ANTES = String.raw`(?:^|[.,;:!?¿¡]\s*|\s+(?:y|e)\s+)`
const ACCION = String.raw`(?:(?:cambia|cambiar|corrige|corregir|actualiza|actualizar|pon|ponle|poner)\s+)?`
const ARTICULO = String.raw`(?:(?:el|la|los|las|su|mi|tu|del|al)\s+)?`
const CONECTOR = String.raw`(?:\s*[:,]\s*|\s+(?:es|son|sera|seria|va a ser|queda(?: como)?|a|por|de)(?:\s+de)?\s+)`

type Marca = { campo: Campo; inicio: number; valorDesde: number }

function marcarEtiquetas(base: string): Marca[] {
  const marcas: Marca[] = []
  for (const [campo, patron, sinConector] of ETIQUETAS) {
    const conector = sinConector ? String.raw`(?:${CONECTOR}|\s+)` : CONECTOR
    const regex = new RegExp(`${ANTES}${ACCION}${ARTICULO}(?:${patron})${conector}`, 'g')
    for (const m of base.matchAll(regex)) {
      const inicio = m.index
      if (marcas.some((otra) => inicio < otra.valorDesde && otra.inicio < inicio + m[0].length)) continue
      marcas.push({ campo, inicio, valorDesde: inicio + m[0].length })
    }
    // Una etiqueta pegada a otra («nombre del evento es» dentro de «el nombre…») no se duplica: ya lo evita el filtro.
  }
  return marcas.sort((a, b) => a.inicio - b.inicio)
}

const sinArticulo = (valor: string) => valor.replace(/^(?:el|la|los|las)\s+/i, '')

// ── Números ───────────────────────────────────────────────────────────────────────────────────────────────────────
const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400,
  cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}
const PALABRA_NUMERO = [...Object.keys(UNIDADES), ...Object.keys(DECENAS), ...Object.keys(CENTENAS), 'mil', 'y'].join('|')

/** Convierte «20», «veinte», «ciento cincuenta» o «mil doscientos» en número. Devuelve undefined si no hay número. */
export function numeroHablado(valor: string): number | undefined {
  const texto = sinAcentos(valor)
  const digitos = texto.match(/(?:^|\s)(-|menos\s+)?(\d[\d.]*)\b/)
  if (digitos) {
    const numero = Number(digitos[2].replace(/\./g, ''))
    return digitos[1] ? -numero : numero
  }
  const palabras = texto.match(new RegExp(`(?:^|\\s)(menos\\s+)?((?:(?:${PALABRA_NUMERO})(?:\\s+|$))+)`))
  if (!palabras) return undefined
  let total = 0
  let actual = 0
  let alguno = false
  for (const p of palabras[2].trim().split(/\s+/)) {
    if (p === 'y') continue
    if (p in UNIDADES) actual += UNIDADES[p]
    else if (p in DECENAS) actual += DECENAS[p]
    else if (p in CENTENAS) actual += CENTENAS[p]
    else if (p === 'mil') {
      total += (actual || 1) * 1000
      actual = 0
    }
    alguno = true
  }
  if (!alguno) return undefined
  const numero = total + actual
  return palabras[1] ? -numero : numero
}

// ── Catálogos ─────────────────────────────────────────────────────────────────────────────────────────────────────
function claveCatalogo(valor: string) {
  return sinAcentos(valor)
    .replace(/[.,;:!?]/g, ' ')
    .replace(/^(?:(?:en|a|de)\s+)?(?:el|la|los|las)\s+/, '')
    .replace(/^(?:en|a|de)\s+/, '')
    .replace(/\b([a-z])\s*-?\s*(\d{1,3})\b/g, '$1$2') // «B 13», «B-13» → «b13»
    .replace(/\s+/g, ' ')
    .trim()
}

function buscarEnCatalogo(valor: string, catalogo: CatalogItem[]) {
  const dicho = claveCatalogo(valor)
  if (!dicho) return []
  const sinEdificio = (nombre: string) => nombre.replace(/^(?:edificio|bloque)s?\s+/, '')
  const exactos = catalogo.filter((item) => {
    const nombre = claveCatalogo(item.nombre)
    return nombre === dicho || sinEdificio(nombre) === sinEdificio(dicho)
  })
  if (exactos.length) return exactos
  return catalogo.filter((item) => {
    const nombre = claveCatalogo(item.nombre)
    const codigo = sinEdificio(nombre)
    if (/^[a-z]\d+$/.test(codigo)) return new RegExp(`\\b${codigo}\\b`).test(dicho)
    return nombre.includes(dicho) || dicho.includes(nombre) || (codigo.length > 2 && dicho.includes(codigo))
  })
}

// ── Fechas ────────────────────────────────────────────────────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const HORA = String.raw`(\d{1,2}(?::\d{2})?|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|mediodia|medianoche)(\s+y\s+(?:media|cuarto|\d{1,2}))?`
const PERIODO = String.raw`(?:\s*(am|pm|de la manana|de la tarde|de la noche|del mediodia|de la madrugada|m)\b)?`
const T = `${HORA}${PERIODO}`

type Hora = { hora: number; minuto: number; periodo?: string; veinticuatro: boolean }

function leerHora(numero: string, extra: string | undefined, periodo: string | undefined): Hora | undefined {
  if (numero === 'mediodia') return { hora: 12, minuto: 0, periodo: 'pm', veinticuatro: true }
  if (numero === 'medianoche') return { hora: 24, minuto: 0, periodo: 'pm', veinticuatro: true }
  const [h, m] = numero.split(':')
  const hora = /^\d+$/.test(h) ? Number(h) : numeroHablado(h)
  if (hora === undefined || hora > 24) return undefined
  let minuto = Number(m ?? 0)
  if (extra) {
    const e = extra.trim().replace(/^y\s+/, '')
    minuto = e === 'media' ? 30 : e === 'cuarto' ? 15 : Number(e)
  }
  if (minuto > 59) return undefined
  const p = periodo?.trim()
  const normal = p === 'de la manana' || p === 'de la madrugada' || p === 'am' ? 'am' : p ? 'pm' : undefined
  return { hora, minuto, periodo: p === 'm' || p === 'del mediodia' ? 'mediodia' : normal, veinticuatro: hora === 0 || hora > 12 }
}

function a24(h: Hora, periodo = h.periodo): number | undefined {
  if (h.veinticuatro) return h.hora
  if (periodo === 'mediodia') return 12
  if (periodo === 'am') return h.hora === 12 ? 0 : h.hora
  if (periodo === 'pm') return h.hora === 12 ? 12 : h.hora + 12
  return undefined
}

function horarioDicho(texto: string): { inicio?: number; fin?: number; faltaPeriodo?: boolean } {
  const rango =
    texto.match(new RegExp(String.raw`\b(?:de|desde)\s+(?:las?\s+)?${T}\s+(?:a|hasta)\s+(?:las?\s+)?${T}`)) ??
    texto.match(new RegExp(String.raw`\bentre\s+(?:las?\s+)?${T}\s+y\s+(?:las?\s+)?${T}`)) ??
    texto.match(new RegExp(String.raw`\ba\s+las?\s+${T}\s+(?:hasta|a)\s+(?:las?\s+)?${T}`)) ??
    texto.match(new RegExp(String.raw`\b${T}\s*-\s*${T}`))
  let ini: Hora | undefined
  let fin: Hora | undefined
  if (rango) {
    ini = leerHora(rango[1], rango[2], rango[3])
    fin = leerHora(rango[4], rango[5], rango[6])
  } else {
    const inicio = texto.match(new RegExp(String.raw`\b(?:a|desde|empieza a|inicia a|comienza a)\s+las?\s+${T}`))
    if (inicio) ini = leerHora(inicio[1], inicio[2], inicio[3])
    const hasta = texto.match(new RegExp(String.raw`\b(?:hasta|termina a|finaliza a|acaba a)\s+(?:las?\s+)?${T}`))
    if (hasta) fin = leerHora(hasta[1], hasta[2], hasta[3])
  }
  if (!ini) return {}
  // El periodo dicho una sola vez vale para las dos horas («de 2 a 5 de la tarde»).
  const periodoIni = ini.periodo ?? (fin && !ini.veinticuatro ? fin.periodo : undefined)
  let inicio = a24(ini, periodoIni)
  if (inicio !== undefined && fin && !ini.periodo && fin.periodo && fin.periodo !== 'mediodia') {
    const finTentativo = a24(fin)
    if (finTentativo !== undefined && inicio >= finTentativo) inicio = a24(ini, 'am') // «de 10 a 2 de la tarde»
  }
  if (periodoIni === 'mediodia') inicio = ini.hora === 12 ? 12 : a24(ini, 'pm')
  if (inicio === undefined) return { faltaPeriodo: true }
  const minutosInicio = inicio * 60 + ini.minuto
  if (!fin) {
    const duracion = texto.match(
      new RegExp(String.raw`\b(?:durante|por)\s+(?:(?:${PALABRA_NUMERO}|\d+)(?:\s+(?:${PALABRA_NUMERO}|\d+))*|una|media)\s+(horas?|minutos?)(\s+y\s+media)?`),
    )
    if (!duracion) return { inicio: minutosInicio }
    const cantidad = /\bmedia\s+hora/.test(duracion[0]) ? 0.5 : numeroHablado(duracion[0].replace(/^(?:durante|por)\s+/, '')) ?? 1
    const minutos = duracion[1].startsWith('hora') ? cantidad * 60 + (duracion[2] ? 30 : 0) : cantidad
    return { inicio: minutosInicio, fin: minutosInicio + minutos }
  }
  let horaFin = a24(fin, fin.periodo ?? periodoIni)
  if (horaFin === undefined) return { faltaPeriodo: true }
  if (!fin.periodo && !fin.veinticuatro && horaFin * 60 <= minutosInicio && horaFin < 12) horaFin += 12 // «de 11 a 1»
  return { inicio: minutosInicio, fin: horaFin * 60 + fin.minuto }
}

function diaDicho(texto: string, ahora: Date): { dia?: Date; conAnio?: boolean } {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const sumar = (dias: number) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
  if (/\bpasado\s+manana\b/.test(texto)) return { dia: sumar(2) }
  if ([...texto.matchAll(/\bmanana\b/g)].some((m) => !/\b(?:la|de)\s*$/.test(texto.slice(0, m.index)))) return { dia: sumar(1) }
  if (/\bhoy\b/.test(texto)) return { dia: hoy }
  const nombreDia = String.raw`(?:(?:${DIAS_SEMANA.join('|')})\s+)?`
  const conMes = texto.match(
    new RegExp(String.raw`\b${nombreDia}(\d{1,2}|primero|${Object.keys(UNIDADES).join('|')}|treinta(?: y (?:un|uno))?)\s+de\s+(${MESES.join('|')})(?:\s+(?:de|del)\s+(\d{4}))?`),
  )
  if (conMes) {
    const numero = conMes[1] === 'primero' ? 1 : /^\d+$/.test(conMes[1]) ? Number(conMes[1]) : numeroHablado(conMes[1])
    if (!numero || numero > 31) return {}
    const anio = conMes[3] ? Number(conMes[3]) : hoy.getFullYear()
    const dia = new Date(anio, MESES.indexOf(conMes[2]), numero)
    return dia.getDate() === numero ? { dia, conAnio: Boolean(conMes[3]) } : {}
  }
  const numerica = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (numerica) {
    const dia = new Date(Number(numerica[3]), Number(numerica[2]) - 1, Number(numerica[1]))
    return dia.getDate() === Number(numerica[1]) ? { dia, conAnio: true } : {}
  }
  const semana = texto.match(new RegExp(String.raw`\b(?:el\s+|este\s+|proximo\s+|el proximo\s+)(${DIAS_SEMANA.join('|')})\b`))
  if (semana) {
    const objetivo = DIAS_SEMANA.indexOf(semana[1])
    const diferencia = (objetivo - hoy.getDay() + 7) % 7 || 7
    return { dia: sumar(diferencia) }
  }
  return {}
}

const pad = (n: number) => String(n).padStart(2, '0')
function iso(dia: Date, minutos: number) {
  const fecha = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, minutos)
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
}

type ResultadoFecha = { fecha?: { inicio: string; fin: string }; mensaje?: string; pendiente?: boolean }

function fechaDicha(original: string, ahora: Date): ResultadoFecha | undefined {
  const texto = normalizar(original)
    .replace(/\b([ap])\.?\s?m\b\.?/g, '$1m') // «3 p. m.», «3 p.m.» → «3 pm»
    .replace(/\s+/g, ' ')
  const { dia, conAnio } = diaDicho(texto, ahora)
  const horario = horarioDicho(texto)
  if (!dia) {
    if (horario.inicio === undefined && !horario.faltaPeriodo) return undefined
    return { mensaje: 'No agregué la fecha: di también el día, por ejemplo «el 20 de noviembre de 2 a 5 de la tarde».' }
  }
  const diaTexto = `${dia.getDate()} de ${MESES[dia.getMonth()]}`
  if (horario.faltaPeriodo) {
    return { pendiente: true, mensaje: `No agregué la fecha del ${diaTexto}: indica si la hora es de la mañana, de la tarde o de la noche.` }
  }
  if (horario.inicio === undefined) {
    return { pendiente: true, mensaje: `No agregué la fecha del ${diaTexto}: indica también la hora de inicio y de fin, por ejemplo «de 2 a 5 de la tarde».` }
  }
  if (horario.fin === undefined) {
    return { pendiente: true, mensaje: `No agregué la fecha del ${diaTexto}: falta la hora de fin. Di, por ejemplo, «hasta las 5 de la tarde» o «durante dos horas».` }
  }
  if (horario.fin <= horario.inicio) {
    return { mensaje: `No agregué la fecha del ${diaTexto}: la hora de fin debe ser posterior a la de inicio.` }
  }
  const inicio = iso(dia, horario.inicio)
  if (new Date(inicio) <= ahora) {
    return {
      mensaje: conAnio
        ? `No agregué la fecha: el ${diaTexto} de ${dia.getFullYear()} ya pasó. Dicta una fecha futura.`
        : `No agregué la fecha: el ${diaTexto} ya pasó. Dicta una fecha futura; si es del próximo año, di también el año.`,
    }
  }
  return { fecha: { inicio, fin: iso(dia, horario.fin) } }
}

// ── Respuestas del modo guiado ────────────────────────────────────────────────────────────────────────────────────
export type PasoVoz = CampoTexto | 'categoria' | 'ubicacion' | 'fecha' | 'otraFecha'
export type ComandoVoz = 'omitir' | 'corregir' | 'repetir' | 'ayuda' | 'terminar' | 'publicar'
type Fecha = { inicio: string; fin: string }

export type RespuestaVoz =
  | { tipo: 'texto'; valor: string; eco: string }
  | { tipo: 'catalogo'; id: number; nombre: string }
  | { tipo: 'opciones'; opciones: CatalogItem[] }
  | { tipo: 'fecha'; fecha: Fecha }
  | { tipo: 'si' }
  | { tipo: 'no' }
  /** Faltan datos: `pendiente` se combina con la siguiente respuesta. Sin `mensaje`, se espera en silencio. */
  | { tipo: 'incompleto'; pendiente: string; mensaje?: string }
  | { tipo: 'error'; mensaje: string }

const sinPuntuacion = (texto: string) => sinAcentos(texto).replace(/[¿?¡!.,;:«»"]/g, ' ').replace(/\s+/g, ' ').trim()

/** Comandos que valen en cualquier pregunta. Solo cuentan si son toda la respuesta. */
export function comandoDicho(texto: string): ComandoVoz | undefined {
  const t = sinPuntuacion(texto)
  if (/^(?:omitir|omite|omitelo|saltar|salta|siguiente|pasar|paso|no aplica|no tengo|ninguno|ninguna)$/.test(t)) return 'omitir'
  if (/^(?:corregir|corrige|correccion|atras|anterior|volver|me equivoque)$/.test(t)) return 'corregir'
  if (/^(?:repetir|repite|repitelo|otra vez|como|que|no te entendi)$/.test(t)) return 'repetir'
  if (/^(?:ayuda|ayudame)$/.test(t)) return 'ayuda'
  if (/^(?:terminar|termina|cancelar|cancela|salir|detener|parar|para)$/.test(t)) return 'terminar'
  if (/^(?:crea|crear|publica|publicar|guarda|guardar)(?: el)?(?: evento)?$/.test(t)) return 'publicar'
  return undefined
}

/** Quita la etiqueta si la persona la repite («el nombre es Feria» → «Feria») y la puntuación final. */
function valorLibre(paso: PasoVoz, texto: string) {
  const base = normalizar(texto)
  const marca = marcarEtiquetas(base).find((m) => m.inicio === 0 && m.campo === paso)
  const valor = marca ? texto.slice(marca.valorDesde) : texto.replace(/^\s*(?:es|son|ser[aá])\s+/i, '')
  return valor.trim().replace(/^[\s,:;]+|[\s.,;:!?]+$/g, '').trim()
}

// Dígitos dichos uno a uno o en grupos («tres cero cero», «trescientos uno, veintitrés, cuarenta y cinco»).
function digitosDichos(texto: string): { digitos: string; sobrante: boolean } {
  const tokens = sinAcentos(texto)
    .replace(/\+/g, ' mas ')
    .replace(/(\d)[\s.,()-]+(?=\d)/g, '$1 ')
    .split(/[\s.,;:()-]+/)
    .filter(Boolean)
  const relleno = /^(?:el|la|mi|es|son|numero|telefono|celular|contacto|de|del|y|al|a|seria|sera)$/
  let digitos = ''
  let sobrante = false
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (/^\d+$/.test(t)) digitos += t
    else if (t === 'mas' && !digitos) digitos += '+'
    else if (t === 'doble' && tokens[i + 1] && tokens[i + 1] in UNIDADES && UNIDADES[tokens[i + 1]] <= 9) {
      digitos += String(UNIDADES[tokens[i + 1]]).repeat(2)
      i += 1
    } else if (t in CENTENAS) {
      let valor = CENTENAS[t]
      const sig = tokens[i + 1]
      if (sig && sig in DECENAS) {
        valor += DECENAS[sig]
        i += 1
        if (tokens[i + 1] === 'y' && tokens[i + 2] in UNIDADES && UNIDADES[tokens[i + 2]] <= 9) {
          valor += UNIDADES[tokens[i + 2]]
          i += 2
        }
      } else if (sig && sig in UNIDADES && UNIDADES[sig] >= 1 && UNIDADES[sig] <= 29) {
        valor += UNIDADES[sig]
        i += 1
      }
      digitos += String(valor)
    } else if (t in DECENAS) {
      let valor = DECENAS[t]
      if (tokens[i + 1] === 'y' && tokens[i + 2] in UNIDADES && UNIDADES[tokens[i + 2]] <= 9) {
        valor += UNIDADES[tokens[i + 2]]
        i += 2
      }
      digitos += String(valor)
    } else if (t in UNIDADES) digitos += String(UNIDADES[t])
    else if (!relleno.test(t)) sobrante = true
  }
  return { digitos, sobrante }
}

function contactoDicho(texto: string, pendiente?: string): RespuestaVoz {
  const valor = valorLibre('contacto', texto)
  const correo = valor
    .replace(/\s+arroba\s+/gi, '@')
    .replace(/\s+punto\s+/gi, '.')
    .replace(/\s+(?:guion bajo|guión bajo)\s+/gi, '_')
  if (/@/.test(correo)) {
    const limpio = correo.replace(/^(?:mi\s+)?(?:correo(?:\s+electr[oó]nico)?\s+)?(?:es\s+)?/i, '').replace(/\s+/g, '').toLowerCase()
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(limpio)) return { tipo: 'texto', valor: limpio, eco: limpio }
    return { tipo: 'error', mensaje: 'No entendí el correo completo. Dilo de nuevo, por ejemplo «juan arroba correo punto com».' }
  }
  const { digitos, sobrante } = digitosDichos(valor)
  if (digitos.replace('+', '').length && !sobrante) {
    const total = (pendiente ?? '') + digitos
    const cantidad = total.replace('+', '').length
    // Un celular o un fijo con indicativo tiene 10 dígitos; con +57, 12. Si faltan, se espera a que la persona siga.
    if (cantidad < 10) return { tipo: 'incompleto', pendiente: total }
    if (cantidad > 13) return { tipo: 'error', mensaje: 'Ese número tiene demasiados dígitos. Dilo de nuevo, despacio.' }
    return { tipo: 'texto', valor: total, eco: total.replace(/^(\+\d{2})?(\d{3})(\d{3})(\d+)$/, (_, p, a, b, c) => [p, a, b, c].filter(Boolean).join(' ')) }
  }
  if (pendiente) return { tipo: 'error', mensaje: 'No entendí el número completo. Dilo de nuevo, despacio.' }
  return valor ? { tipo: 'texto', valor, eco: valor } : { tipo: 'error', mensaje: 'No entendí el contacto.' }
}

function enlaceDicho(texto: string): RespuestaVoz {
  let enlace = valorLibre('enlace_externo', texto)
    .replace(/\s+dos\s+puntos\s*/gi, ':')
    .replace(/\s*\bbarra\b\s*/gi, '/')
    .replace(/\s+punto\s+/gi, '.')
    .replace(/\s+/g, '')
    .replace(/[.,;]+$/, '')
  if (enlace && !/^https?:\/\//i.test(enlace)) enlace = `https://${enlace}`
  try {
    const url = new URL(enlace)
    if (/^https?:$/.test(url.protocol) && url.hostname.includes('.')) return { tipo: 'texto', valor: enlace, eco: enlace.replace(/^https?:\/\//, '') }
  } catch {
    // se informa abajo
  }
  return { tipo: 'error', mensaje: 'No entendí el enlace. Dilo de nuevo, por ejemplo «forms punto gle barra feria», o di «omitir» y escríbelo a mano.' }
}

const ORDINALES: Record<string, number> = { primera: 0, primero: 0, uno: 0, una: 0, '1': 0, segunda: 1, segundo: 1, dos: 1, '2': 1, tercera: 2, tercero: 2, tres: 2, '3': 2, cuarta: 3, cuarto: 3, cuatro: 3, '4': 3 }

function catalogoDicho(paso: 'categoria' | 'ubicacion', texto: string, catalogo: CatalogItem[], opciones?: CatalogItem[]): RespuestaVoz {
  const valor = valorLibre(paso, texto)
  const nombreCampo = paso === 'categoria' ? 'categoría' : 'ubicación'
  if (opciones?.length) {
    const ordinal = sinPuntuacion(valor).replace(/^(?:la|el|opcion)\s+/, '').split(' ')[0]
    if (ordinal in ORDINALES && opciones[ORDINALES[ordinal]]) return { tipo: 'catalogo', ...opciones[ORDINALES[ordinal]] }
    const entreOpciones = buscarEnCatalogo(valor, opciones)
    if (entreOpciones.length === 1) return { tipo: 'catalogo', ...entreOpciones[0] }
  }
  const encontrados = buscarEnCatalogo(valor, catalogo)
  if (encontrados.length === 1) return { tipo: 'catalogo', ...encontrados[0] }
  if (encontrados.length > 1) return { tipo: 'opciones', opciones: encontrados }
  const lista = catalogo.length && catalogo.length <= 8 ? ` Las opciones son: ${catalogo.map((c) => c.nombre).join(', ')}.` : ''
  return { tipo: 'error', mensaje: `No encontré «${valor}» en la lista de ${nombreCampo}.${lista}` }
}

/**
 * Interpreta la respuesta a la pregunta del paso indicado. Los comandos («omitir», «corregir»…) se revisan antes
 * con `comandoDicho`. `pendiente` es lo que quedó incompleto en la respuesta anterior (una fecha sin horario o un
 * número de contacto a medias) y se combina con esta respuesta.
 */
export function interpretarRespuesta(
  paso: PasoVoz,
  texto: string,
  contexto: { categorias?: CatalogItem[]; ubicaciones?: CatalogItem[]; opciones?: CatalogItem[]; pendiente?: string } = {},
): RespuestaVoz {
  const ahora = new Date()
  switch (paso) {
    case 'nombre':
    case 'descripcion':
    case 'responsable':
    case 'detalle_ubicacion': {
      let valor = valorLibre(paso, texto)
      if (paso === 'responsable' || paso === 'detalle_ubicacion') valor = sinArticulo(valor)
      if (!valor) return { tipo: 'error', mensaje: 'No escuché la respuesta.' }
      return { tipo: 'texto', valor, eco: valor.length > 80 ? '' : valor }
    }
    case 'cupo': {
      const cupo = numeroHablado(valorLibre(paso, texto))
      if (cupo === undefined || cupo <= 0 || !Number.isInteger(cupo)) {
        return { tipo: 'error', mensaje: 'El cupo debe ser un número entero positivo.' }
      }
      return { tipo: 'texto', valor: String(cupo), eco: `${cupo} personas` }
    }
    case 'contacto':
      return contactoDicho(texto, contexto.pendiente)
    case 'enlace_externo':
      return enlaceDicho(texto)
    case 'categoria':
      return catalogoDicho('categoria', texto, contexto.categorias ?? [])
    case 'ubicacion':
      return catalogoDicho('ubicacion', texto, contexto.ubicaciones ?? [], contexto.opciones)
    case 'otraFecha': {
      const t = sinPuntuacion(texto)
      if (/^(?:si|claro|dale|vale|ok|okay|bueno|por favor|si por favor|otra|una mas)\b/.test(t) && !diaDicho(t, ahora).dia) return { tipo: 'si' }
      if (/^(?:no|nop|listo|ya|ya esta|ninguna|no gracias|asi esta bien|eso es todo)\b/.test(t)) return { tipo: 'no' }
      if (!diaDicho(normalizar(texto), ahora).dia) return { tipo: 'error', mensaje: 'Responde sí o no.' }
      return interpretarRespuesta('fecha', texto, contexto)
    }
    case 'fecha': {
      const textoFecha = valorLibre('fecha', texto)
      let resultado = fechaDicha(textoFecha, ahora)
      if (contexto.pendiente && (!resultado || /di también el día/.test(resultado.mensaje ?? '') || resultado.pendiente)) {
        const combinado = fechaDicha(`${contexto.pendiente} ${textoFecha}`, ahora)
        if (combinado) resultado = combinado
        if (combinado?.pendiente) return { tipo: 'incompleto', pendiente: `${contexto.pendiente} ${textoFecha}`, mensaje: combinado.mensaje }
      }
      if (!resultado) return { tipo: 'error', mensaje: 'No entendí la fecha. Di, por ejemplo, «el 20 de noviembre de 2 a 5 de la tarde».' }
      if (resultado.fecha) return { tipo: 'fecha', fecha: resultado.fecha }
      if (resultado.pendiente) return { tipo: 'incompleto', pendiente: textoFecha, mensaje: resultado.mensaje }
      return { tipo: 'error', mensaje: resultado.mensaje ?? 'No entendí la fecha.' }
    }
  }
}

/** Describe una fecha para que el asistente la confirme en voz alta. */
export function fechaEnPalabras(fecha: Fecha) {
  const inicio = new Date(fecha.inicio)
  const fin = new Date(fecha.fin)
  const hora = (d: Date) => {
    const h = d.getHours()
    const m = d.getMinutes()
    const h12 = h % 12 || 12
    const periodo = h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche'
    return `${h12}${m ? `:${pad(m)}` : ''} ${h === 12 && !m ? 'del mediodía' : periodo}`
  }
  return `el ${inicio.getDate()} de ${MESES[inicio.getMonth()]}, de ${hora(inicio)} a ${hora(fin)}`
}
