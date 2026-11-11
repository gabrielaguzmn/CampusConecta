import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { executeIntent, type NavigationAdapter } from '../actionRegistry'
import type { Intent, Page, SpeechState } from '../assistantTypes'
import { ASSISTANT_RESPONSES } from '../catalogs/responses'
import { interpretConfirmation } from '../confirmation'
import { interpretAsync } from '../semantic/hybridInterpreter'
import type { SpeechProvider } from '../speech/SpeechProvider'
import { WebSpeechProvider } from '../speech/webSpeechProvider'
import { AssistantFeedback } from './AssistantFeedback'
import { VoiceButton } from './VoiceButton'

function pageFromPath(pathname: string): Page {
  if (pathname.startsWith('/mapa')) return 'MAP'
  if (pathname.startsWith('/mis-eventos')) return 'MY_EVENTS'
  if (pathname.startsWith('/eventos/nuevo')) return 'CREATE_EVENT'
  return 'FEED'
}

const PATHS: Record<Page, string> = {
  MAP: '/mapa',
  FEED: '/feed',
  MY_EVENTS: '/mis-eventos',
  CREATE_EVENT: '/mis-eventos',
}

const INTENT_LABELS = {
  OPEN_MAP: 'abrir el mapa',
  OPEN_FEED: 'ver el Feed',
  OPEN_MY_EVENTS: 'ver mis eventos',
  CREATE_EVENT: 'crear un evento',
} as const

export function VoiceAssistant({ createProvider = () => new WebSpeechProvider() }: { createProvider?: () => SpeechProvider }) {
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location.pathname)
  const [state, setState] = useState<SpeechState>('idle')
  const [interim, setInterim] = useState('')
  const [final, setFinal] = useState('')
  const [response, setResponse] = useState('')
  const providerRef = useRef<SpeechProvider | null>(null)
  const pendingIntentRef = useRef<Exclude<Intent, 'UNKNOWN'> | null>(null)
const confirmationTimerRef = useRef<number | null>(null)

  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  async function runCommand(text: string) {
    const navigation: NavigationAdapter = {
      getCurrentPage: () => pageFromPath(locationRef.current),
      goTo: (page) => navigate(PATHS[page]),
    }
    const pendingIntent = pendingIntentRef.current
    if (pendingIntent) {
      const confirmation = interpretConfirmation(text)
      setFinal(text)
      setInterim('')
      if (confirmation === 'accept') {
        pendingIntentRef.current = null
        setResponse(executeIntent(pendingIntent, navigation).response)
      } else if (confirmation === 'reject') {
        pendingIntentRef.current = null
        // Cancelar vuelve el asistente al mismo estado limpio de una orden terminada.
        setFinal('')
        setInterim('')
        setResponse('')
      } else {
        setResponse('Responde “sí” para continuar o “no” para cancelar.')
      }
      setState('idle')
      return
    }
    const result = await interpretAsync(text, { currentPage: navigation.getCurrentPage() })
    const action = result.suggestion
      ? { response: `¿Quisiste decir “${result.suggestion.intent ? INTENT_LABELS[result.suggestion.intent] : 'esa acción'}”?`, navigated: false }
      : executeIntent(result.intent, navigation)
    setFinal(text)
    setInterim('')
    pendingIntentRef.current = result.suggestion?.intent ?? null
    const semanticScore = result.suggestion?.score ?? result.confidence
    setResponse(`${action.response}${import.meta.env.DEV && result.source === 'semantic' && semanticScore > 0 ? ` (similitud ${semanticScore.toFixed(2)})` : ''}`)
    setState('idle')
if (result.suggestion?.intent) {
// Wait for the recognition session that produced the suggestion to finish before restarting it.
confirmationTimerRef.current = window.setTimeout(() => {
if (!pendingIntentRef.current) return
setState('listening')
providerRef.current?.start()
}, 150)
}
  }

  useEffect(() => {
    const provider = createProvider()
    providerRef.current = provider
    provider.onInterimResult((text) => setInterim(text))
    provider.onFinalResult((text) => {
      setState('processing')
      void runCommand(text)
    })
    provider.onError((error) => {
      setResponse(ASSISTANT_RESPONSES.speechError(error))
      setState('error')
    })
return () => {
if (confirmationTimerRef.current !== null) window.clearTimeout(confirmationTimerRef.current)
provider.stop()
}
  // The provider factory is an injection seam and must remain stable in consumers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleListening() {
    if (state === 'listening') {
      providerRef.current?.stop()
      setState('processing')
      return
    }
    setInterim('')
    setFinal('')
    setResponse('')
    setState('listening')
    providerRef.current?.start()
  }

  return (
    <section className="fixed bottom-4 right-4 z-50 flex max-w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2" aria-label="Asistente de voz">
      {(interim || final || response) && (
        <div className="w-full rounded-tarjeta border border-borde bg-superficie p-3 text-sm shadow-elevada">
          {interim && <p><span className="font-semibold">Escuchando:</span> {interim}</p>}
          {final && <p><span className="font-semibold">Entendido:</span> {final}</p>}
          {response && <p className="mt-1 text-texto-secundario">{response}</p>}
        </div>
      )}
      {import.meta.env.DEV && (
        <form className="flex w-full gap-2 rounded-tarjeta border border-borde bg-superficie p-2 shadow-elevada" onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const command = String(form.get('voice-command') ?? '').trim()
          if (command) void runCommand(command)
          event.currentTarget.reset()
        }}>
          <label className="sr-only" htmlFor="voice-command">Comando de voz de prueba</label>
          <input id="voice-command" name="voice-command" className="min-w-0 flex-1 rounded-control border border-borde px-2 py-1" placeholder="Probar comando" />
          <button type="submit" className="rounded-control bg-primario px-2 py-1 text-sm font-semibold text-white">Enviar</button>
        </form>
      )}
      <VoiceButton state={state} onClick={toggleListening} />
      <AssistantFeedback state={state} interim={interim} final={final} response={response} />
    </section>
  )
}
