export type Page = 'MAP' | 'FEED' | 'MY_EVENTS' | 'CREATE_EVENT'

export type AssistantContext = { currentPage: Page }

export type Intent = 'OPEN_MAP' | 'OPEN_FEED' | 'OPEN_MY_EVENTS' | 'CREATE_EVENT' | 'UNKNOWN'

export type IntentEntities = Record<string, never>

export type IntentResult = {
  intent: Intent
  entities: IntentEntities
  confidence: number
  normalizedText: string
  ambiguous?: boolean
}

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error'

export type SpeechError = 'not-allowed' | 'no-speech' | 'network' | 'not-supported' | 'aborted' | 'unknown'
