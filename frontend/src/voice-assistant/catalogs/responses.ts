import type { Page, SpeechError } from '../assistantTypes'
import { PAGE_LABELS } from './intents'

export const ASSISTANT_RESPONSES = {
  createEventSoon: 'La creación de eventos por voz estará disponible pronto.',
  unknown: 'No entendí el comando. Puedes decir: “abre el mapa”, “muéstrame los eventos” o “abre mis eventos”.',
  navigating: (page: Page) => `Abriendo ${PAGE_LABELS[page]}.`,
  alreadyThere: (page: Page) => `Ya estás en ${PAGE_LABELS[page]}.`,
  speechStartError: 'No se pudo iniciar el reconocimiento de voz. Inténtalo de nuevo.',
  speechError: (error: SpeechError) => ({
    'not-allowed': 'No se concedió permiso para usar el micrófono. Puedes usar el campo de texto de desarrollo.',
    'no-speech': 'No se detectó voz. Inténtalo de nuevo cuando estés listo.',
    network: 'Hubo un problema de red al reconocer la voz. Inténtalo de nuevo.',
    'not-supported': 'Tu navegador no es compatible con el reconocimiento de voz. Puedes seguir navegando normalmente.',
    aborted: 'La escucha fue cancelada.',
    unknown: 'No fue posible reconocer la voz. Inténtalo de nuevo.',
  })[error],
}
