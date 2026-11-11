import { INTENT_RULES } from '../catalogs/intents'
import type { AssistantContext, IntentResult } from '../assistantTypes'
import { interpret } from '../intentRecognizer'
import { HttpSemanticMatcher } from './httpSemanticMatcher'
import type { SemanticMatcher, SemanticResult } from './SemanticMatcher'
import { semanticConfig } from './semanticConfig'

export type HybridResult = IntentResult & { source: 'rules' | 'semantic'; suggestion?: SemanticResult }
const matcher = new HttpSemanticMatcher()
export function semanticAllowed(_context: AssistantContext) { return true }
export async function interpretAsync(text: string, context: AssistantContext, service: SemanticMatcher = matcher): Promise<HybridResult> {
  const rules = interpret(text, context)
  if (rules.intent !== 'UNKNOWN' && !rules.ambiguous) return { ...rules, source: 'rules' }
  if (!semanticConfig.enabled || !semanticAllowed(context)) return { ...rules, intent: 'UNKNOWN', source: 'rules' }
  try {
    const semantic = await service.match(text, context.currentPage, INTENT_RULES.map((rule) => rule.intent))
    if (semantic.decision === 'accept' && semantic.intent) return { ...rules, intent: semantic.intent, confidence: semantic.score ?? 0, source: 'semantic' }
    if (semantic.decision === 'suggest') return { ...rules, intent: 'UNKNOWN', source: 'semantic', suggestion: semantic }
  } catch { /* Optional service: keep voice navigation silent and deterministic. */ }
  return { ...rules, intent: 'UNKNOWN', source: 'rules' }
}
