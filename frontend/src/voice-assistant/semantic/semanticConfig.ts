export const semanticConfig = {
  enabled: import.meta.env.VITE_VOICE_SEMANTIC_ENABLED !== '0',
  timeoutMs: Number(import.meta.env.VITE_VOICE_SEMANTIC_TIMEOUT_MS ?? 1500),
  baseUrl: import.meta.env.VITE_API_URL || window.location.origin,
}
