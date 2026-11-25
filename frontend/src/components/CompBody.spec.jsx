import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompBody from './CompBody.jsx'

const body = '**Status:** Reported median\n**Company:** Accenture\n**Position:** Software Engineer: SSE (SDE-2)\n**Location:** India\n\n**Compensation**\n- **Total (per year, median): ₹12.6 LPA** (₹12,63,030)'

describe('CompBody', () => {
  it('shows facts and pay as a card, with no raw markdown, no notes block and no source line', () => {
    const { container } = render(<CompBody body={body} />)
    expect(screen.getByText('Accenture')).toBeTruthy()
    expect(screen.getByText('Total (per year, median): ₹12.6 LPA')).toBeTruthy()
    expect(container.textContent).not.toContain('Source')
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).not.toContain('Benefits and notes')
  })
  it('leaves an ordinary post as plain text', () => {
    render(<CompBody body="Rounds were hard." />)
    expect(screen.getByText('Rounds were hard.')).toBeTruthy()
  })
})

describe('CompBody for a company post', () => {
  const company = '**Company:** Accenture\n**Segment:** IT services / Consulting\n**Location:** India\n\n**Compensation**\n- **ASE** (SDE-1 / Entry, 1-2 years): ₹6.9 LPA\n- **SSE** (SDE-2, 4-5 years): ₹12.6 LPA\n- Company median across levels: ₹8.2 LPA'
  it('lists every level with its pay', () => {
    const { container } = render(<CompBody body={company} />)
    expect(screen.getByText('ASE')).toBeTruthy()
    expect(screen.getByText('₹12.6 LPA')).toBeTruthy()
    expect(screen.getByText('SDE-2, 4-5 years')).toBeTruthy()
    expect(container.textContent).toContain('Company median across levels: ₹8.2 LPA')
    expect(container.textContent).not.toContain('**')
  })
})

