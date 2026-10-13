import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { tokens } from '../auth/tokens'

afterEach(() => {
  cleanup()
  tokens.borrar()
  vi.unstubAllGlobals()
})
