import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompBody from './CompBody.jsx'

const body = '**Status:** Offer\n**Company:** Accenture\n**Position:** SDE-2\n**Location:** India\n\n**Compensation**\n- **Total (per year): ₹12.6 LPA**'

describe('CompBody', () => {
  it('shows facts and pay as a card, with no raw markdown, no notes block and no source line', () => {
    const { container } = render(<CompBody body={body} />)
    expect(screen.getByText('Accenture')).toBeTruthy()
    expect(screen.getByText('Total (per year): ₹12.6 LPA')).toBeTruthy()
    expect(container.textContent).not.toContain('Source')
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).not.toContain('Benefits and notes')
  })
  it('leaves an ordinary post as plain text', () => {
    render(<CompBody body="Rounds were hard." />)
    expect(screen.getByText('Rounds were hard.')).toBeTruthy()
  })
})
