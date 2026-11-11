import type { Intent, Page } from './assistantTypes'
import { PAGE_BY_INTENT } from './catalogs/intents'
import { ASSISTANT_RESPONSES } from './catalogs/responses'

export interface NavigationAdapter {
  getCurrentPage(): Page
  goTo(page: Page): void
}

export type ActionResult = { response: string; navigated: boolean }

export function executeIntent(intent: Intent, navigation: NavigationAdapter): ActionResult {
  if (intent === 'UNKNOWN') return { response: ASSISTANT_RESPONSES.unknown, navigated: false }

  const target = PAGE_BY_INTENT[intent]
  if (!target) return { response: ASSISTANT_RESPONSES.unknown, navigated: false }
  if (navigation.getCurrentPage() === target) {
    return { response: ASSISTANT_RESPONSES.alreadyThere(target), navigated: false }
  }

  navigation.goTo(target)
  return { response: ASSISTANT_RESPONSES.navigating(target), navigated: true }
}
