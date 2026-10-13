import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('Chip (Figma 4:30135 · 5:11–5:12)', () => {
  it('expone su estado activo o inactivo', () => {
    render(
      <>
        <Chip activo>Todos</Chip>
        <Chip activo={false}>Talleres</Chip>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Talleres' })).toHaveAttribute('aria-pressed', 'false')
  })
})
