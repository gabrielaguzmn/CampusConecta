import type { SpeechState } from '../assistantTypes'

export function AssistantFeedback({ state, interim, final, response }: { state: SpeechState; interim: string; final: string; response: string }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {state === 'listening' && 'Escuchando.'}
      {interim && `Transcripción provisional: ${interim}.`}
      {final && `Entendido: ${final}.`}
      {response}
    </div>
  )
}
