import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Markdown from './Markdown.jsx'

const SAMPLE = `Suppose a service is measured over 30 days:

\\[

Availability = \\frac{30\\ days - 30\\ minutes}{30\\ days} \\times 100

\\]

The result is approximately 99.9306%.`

describe('Markdown math', () => {
  it('renders a \\[ ... \\] block (even with blank lines inside) as a formula, not raw LaTeX', async () => {
    const { container } = render(<Markdown text={SAMPLE} />)
    await waitFor(() => expect(container.querySelector('.katex-display')).toBeTruthy())
    expect(container.textContent).not.toContain('\\frac')
    expect(container.textContent).not.toContain('\\[')
    expect(screen.getByText(/The result is approximately 99.9306%/)).toBeTruthy()
  })

  it('renders $$ ... $$ and a one-line \\[ ... \\] as display math', async () => {
    const { container } = render(<Markdown text={'$$\n\\frac{a}{b}\n$$\n\n\\[ x^2 \\]'} />)
    await waitFor(() => expect(container.querySelectorAll('.katex-display').length).toBe(2))
  })

  it('renders inline \\( ... \\) inside a sentence', async () => {
    const { container } = render(<Markdown text={'Availability is \\(\\frac{a}{b}\\) of the time.'} />)
    await waitFor(() => expect(container.querySelector('.katex')).toBeTruthy())
    expect(container.textContent).toContain('of the time.')
    expect(container.querySelector('.katex-display')).toBeNull()
  })

  it('leaves text without formulas alone, including a dollar price', () => {
    const { container } = render(<Markdown text={'It costs $5 and $10.\n\n- a list item'} />)
    expect(container.textContent).toContain('It costs $5 and $10.')
    expect(container.querySelector('[role="math"]')).toBeNull()
  })

  it('shows an unclosed \\[ as plain text instead of swallowing the page', () => {
    const { container } = render(<Markdown text={'\\[ x\n\nmore text after'} />)
    expect(container.textContent).toContain('more text after')
  })
})
