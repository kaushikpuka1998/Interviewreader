import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnThisPage from './OnThisPage.jsx'

const MD = '## Alpha\n### A1\n### A2\n## Beta\n'

describe('OnThisPage collapse', () => {
  it('hides and shows a section\'s children', () => {
    render(<OnThisPage text={MD} scrollRef={{ current: null }} />)
    expect(screen.getByText('A1')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Collapse Alpha'))
    expect(screen.queryByText('A1')).toBeNull()
    expect(screen.getByText('Beta')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Expand Alpha'))
    expect(screen.getByText('A2')).toBeTruthy()
  })
})

describe('OnThisPage hide', () => {
  it('shows only an expand icon when closed', () => {
    let open = false
    const t = () => { open = !open }
    const { rerender } = render(<OnThisPage text={MD} scrollRef={{ current: null }} open={false} onToggle={t} />)
    expect(screen.queryByText('Alpha')).toBeNull()
    fireEvent.click(screen.getByLabelText('Show sections'))
    expect(open).toBe(true)
    rerender(<OnThisPage text={MD} scrollRef={{ current: null }} open onToggle={t} />)
    expect(screen.getByLabelText('Hide sections')).toBeTruthy()
  })
})

describe('OnThisPage icon state', () => {
  it('is inactive when the answer has no sections', () => {
    render(<OnThisPage text={'just prose'} scrollRef={{ current: null }} open onToggle={() => {}} />)
    expect(screen.getByLabelText('Show sections').disabled).toBe(true)
  })
})
