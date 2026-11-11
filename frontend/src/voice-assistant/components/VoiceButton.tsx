import { Mic, Square, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { SpeechState } from '../assistantTypes'

const CONFIG: Record<SpeechState, { label: string; Icon: typeof Mic }> = {
  idle: { label: 'Hablar', Icon: Mic },
  listening: { label: 'Detener escucha', Icon: Square },
processing: { label: 'Interpretando…', Icon: LoaderCircle },
  error: { label: 'Reintentar voz', Icon: TriangleAlert },
}

export function VoiceButton({ state, onClick }: { state: SpeechState; onClick: () => void }) {
  const { label, Icon } = CONFIG[state]
  const isBusy = state === 'processing'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={false}
      aria-label={label}
      aria-pressed={state === 'listening'}
      className="inline-flex min-h-10 items-center gap-2 rounded-control border border-primario bg-superficie px-3 py-2 text-sm font-semibold text-primario transition hover:bg-badge disabled:cursor-wait disabled:opacity-70"
    >
      <Icon size={17} className={isBusy ? 'animate-spin' : ''} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
