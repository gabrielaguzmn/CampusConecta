import type { SpeechError, SpeechState } from '../assistantTypes'
import type { SpeechProvider } from './SpeechProvider'

type RecognitionResultItem = { transcript: string }
type RecognitionResultLike = { isFinal: boolean; 0: RecognitionResultItem }
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResultLike> }
type RecognitionErrorEventLike = { error: string }
type RecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type RecognitionConstructor = new () => RecognitionInstance

function browserConstructor(): RecognitionConstructor | undefined {
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function toSpeechError(error: string): SpeechError {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'not-allowed'
  if (error === 'no-speech') return 'no-speech'
  if (error === 'network') return 'network'
  if (error === 'aborted') return 'aborted'
  return 'unknown'
}

export class WebSpeechProvider implements SpeechProvider {
  state: SpeechState = 'idle'
  private readonly recognition: RecognitionInstance | undefined
  private interimListener: (transcript: string) => void = () => undefined
  private finalListener: (transcript: string) => void = () => undefined
  private errorListener: (error: SpeechError) => void = () => undefined

  constructor() {
    const Recognition = browserConstructor()
    if (!Recognition) return
    this.recognition = new Recognition()
    this.recognition.lang = 'es-CO'
    this.recognition.interimResults = true
    this.recognition.continuous = false
    this.recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (interim) this.interimListener(interim.trim())
      if (final) this.finalListener(final.trim())
    }
    this.recognition.onerror = (event) => {
      this.state = 'error'
      this.errorListener(toSpeechError(event.error))
    }
    this.recognition.onend = () => {
      if (this.state === 'listening') this.state = 'idle'
    }
  }

  start(): void {
    if (!this.recognition) {
      this.state = 'error'
      this.errorListener('not-supported')
      return
    }
    this.state = 'listening'
    this.recognition.start()
  }

  stop(): void {
    this.recognition?.stop()
    if (this.state === 'listening') this.state = 'processing'
  }

  onInterimResult(listener: (transcript: string) => void): void { this.interimListener = listener }
  onFinalResult(listener: (transcript: string) => void): void { this.finalListener = listener }
  onError(listener: (error: SpeechError) => void): void { this.errorListener = listener }
}
