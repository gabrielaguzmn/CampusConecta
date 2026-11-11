import type { Intent, Page } from '../assistantTypes'

export type SemanticResult = { decision: 'accept' | 'suggest' | 'none'; intent?: Exclude<Intent, 'UNKNOWN'>; score?: number; margin?: number; candidates: Array<{ intent: Exclude<Intent, 'UNKNOWN'>; score: number }> }
export interface SemanticMatcher { match(text: string, page: Page, candidateIntents?: Exclude<Intent, 'UNKNOWN'>[]): Promise<SemanticResult> }
