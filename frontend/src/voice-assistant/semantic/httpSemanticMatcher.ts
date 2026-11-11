import { fetchConSesion } from '../../api/client'
import type { Intent, Page } from '../assistantTypes'
import type { SemanticMatcher, SemanticResult } from './SemanticMatcher'
import { semanticConfig } from './semanticConfig'

export class HttpSemanticMatcher implements SemanticMatcher {
  private failures = 0
  private blockedUntil = 0
  async match(text: string, page: Page, candidateIntents?: Exclude<Intent, 'UNKNOWN'>[]): Promise<SemanticResult> {
    if (Date.now() < this.blockedUntil) throw new Error('semantic circuit open')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), semanticConfig.timeoutMs)
    try {
      const response = await fetchConSesion(new Request(`${semanticConfig.baseUrl}/api/voice/semantic-match/`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, page, ...(candidateIntents?.length ? { candidate_intents: candidateIntents } : {}) }) }))
      if (!response.ok) throw new Error(`semantic HTTP ${response.status}`)
      this.failures = 0
      return await response.json() as SemanticResult
    } catch (error) {
      if (++this.failures >= 3) this.blockedUntil = Date.now() + 60_000
      throw error
    } finally { window.clearTimeout(timer) }
  }
}
