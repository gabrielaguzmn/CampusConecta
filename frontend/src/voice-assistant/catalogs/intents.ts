import type { Intent, Page } from '../assistantTypes'

export type IntentRule = {
  intent: Exclude<Intent, 'UNKNOWN'>
  aliases: readonly string[]
}

export const INTENT_RULES: readonly IntentRule[] = [
  {
    intent: 'CREATE_EVENT',
    aliases: [
      'crear un evento', 'crea un evento', 'crear evento', 'registrar una actividad',
      'registrar un evento', 'publicar un evento', 'publica un evento', 'organizar un evento', 'organizar una actividad', 'anunciar un evento',
      'agregar un evento', 'abrir formulario de eventos', 'abre el formulario de eventos', 'abrir el formulario de eventos',
    ],
  },
  {
    intent: 'OPEN_MY_EVENTS',
    aliases: [
      'abre mis eventos', 've a mis eventos', 'muestrame mis publicaciones',
      'consultar mis eventos', 'que eventos he creado', 'muestrame lo que he publicado',
      'ver mi historial', 'muestrame mis eventos activos', 'mis publicaciones', 'mis eventos',
      'mi historial', 'he creado', 'he publicado', 'lo que publique',
    ],
  },
  {
    intent: 'OPEN_MAP',
    aliases: [
      'abre el mapa', 'abreme el mapa', 've al mapa', 'muestrame el mapa', 'consultar el mapa',
      'ver donde estan los eventos', 'donde puedo encontrar los eventos', 'seccion del mapa',
      'vamos al mapa', 'pestana de ubicacion', 'pestana de ubicaciones', 'vuelve al mapa',
      'ubicacion de los eventos',
    ],
  },
  {
    intent: 'OPEN_FEED',
    aliases: [
      'abre el feed', 've al feed', 'muestrame los eventos', 'consultar los eventos',
      'ver que actividades hay', 'ensename las publicaciones', 'lista de eventos',
      'seccion de eventos', 'explorar las actividades', 'vuelve al feed', 'quiero ver los eventos',
      'quiero ver todos los eventos', 'muestrame todos los eventos', 'las publicaciones',
    ],
  },
]

export const PAGE_LABELS: Record<Page, string> = {
  MAP: 'el Mapa',
  FEED: 'el Feed',
  MY_EVENTS: 'Mis eventos',
  CREATE_EVENT: 'Crear evento',
}

export const PAGE_BY_INTENT: Partial<Record<Intent, Page>> = {
  OPEN_MAP: 'MAP',
  OPEN_FEED: 'FEED',
  OPEN_MY_EVENTS: 'MY_EVENTS',
  CREATE_EVENT: 'CREATE_EVENT',
}
