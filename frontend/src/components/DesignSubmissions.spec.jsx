import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../lib/designPractice.js', () => ({
  fetchDesignSubmissions: () => Promise.resolve({
    solved: 1, submitted: 2,
    items: [
      { questionId: 'q1', title: 'Design Uber.', submissions: 3, solved: true, bestTargetRps: 100000000, lastAt: '2026-11-13T10:00:00Z' },
      { questionId: 'q2', title: 'Design Netflix.', submissions: 1, solved: false, bestTargetRps: 0, lastAt: '2026-11-08T10:00:00Z' },
    ],
  }),
}))
import DesignSubmissions from './DesignSubmissions.jsx'

describe('DesignSubmissions', () => {
  it('lists submissions with solved status and best RPS', async () => {
    render(<DesignSubmissions />)
    expect(await screen.findByText('Design Uber.')).toBeTruthy()
    expect(screen.getByText('✓ Solved')).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText(/passed up to 100M RPS/)).toBeTruthy()
  })
  it('links each row to its question', async () => {
    render(<DesignSubmissions />)
    const link = (await screen.findByText('Design Uber.')).closest('a')
    expect(link.getAttribute('href')).toBe('/interview/practice?q=q1')
  })
})
