import type { SpeechError, SpeechState } from '../assistantTypes'

export interface SpeechProvider {
  readonly state: SpeechState
  start(): void
  stop(): void
  onInterimResult(listener: (transcript: string) => void): void
  onFinalResult(listener: (transcript: string) => void): void
  onError(listener: (error: SpeechError) => void): void
}
