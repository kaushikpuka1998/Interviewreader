import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import GuestNudge from './GuestNudge.jsx'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })

const show = props => render(<GuestNudge onSignup={() => {}} {...props} />)

describe('GuestNudge', () => {
  it('appears after two different questions and not for members', () => {
    const { rerender } = show({ questionId: 'a' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.queryByText('Create free account')).toBeNull()
    rerender(<GuestNudge questionId="b" onSignup={() => {}} />)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Create free account')).toBeTruthy()
    rerender(<GuestNudge questionId="b" signedIn onSignup={() => {}} />)
    expect(screen.queryByText('Create free account')).toBeNull()
  })

  it('stays away for a day once dismissed', () => {
    localStorage.setItem('ir_guest_seen', '["a","b"]')
    const first = show({ questionId: 'c' })
    act(() => { vi.advanceTimersByTime(2000) })
    fireEvent.click(screen.getByLabelText('Dismiss'))
    first.unmount()
    show({ questionId: 'd' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.queryByText('Create free account')).toBeNull()
  })

  it('opens the sign-up dialog', () => {
    localStorage.setItem('ir_guest_seen', '["a","b"]')
    const onSignup = vi.fn()
    show({ questionId: 'c', onSignup })
    act(() => { vi.advanceTimersByTime(2000) })
    fireEvent.click(screen.getByText('Create free account'))
    expect(onSignup).toHaveBeenCalled()
  })
})
