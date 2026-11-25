import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./TopBar.jsx', () => ({ default: () => null }))
vi.mock('./Footer.jsx', () => ({ default: () => null }))
vi.mock('./ActivityHeatmap.jsx', () => ({ default: () => <div>heatmap</div> }))
vi.mock('./AuthModal.jsx', () => ({ default: () => null }))
vi.mock('../lib/seo.js', () => ({ setPageSeo: vi.fn() }))
vi.mock('../lib/auth.js', () => ({ getUser: () => ({ name: 'Kaushik Ghosh' }), isLoggedIn: vi.fn(() => true), fetchProgress: async () => ({ read: ['a', 'b', 'c'] }) }))
vi.mock('../lib/points.js', () => ({ fetchPoints: async () => ({ streak: 4, best: 9, weekPoints: 120, totalPoints: 1250, league: 'Gold', nextMilestone: { daysLeft: 3, days: 7 } }) }))
vi.mock('../lib/engage.js', () => ({ fetchQotd: async () => ({ id: 'q1', title: 'What is a reverse proxy?', problem: { title: 'Two Sum', difficulty: 'Basic' } }) }))
vi.mock('../lib/code.js', () => ({ fetchSolvedIds: async () => [1, 2] }))

import DashboardPage, { greeting } from './DashboardPage.jsx'
import { isLoggedIn } from '../lib/auth.js'

describe('DashboardPage', () => {
  it('greets by time of day', () => {
    expect(greeting(8)).toBe('Good morning')
    expect(greeting(14)).toBe('Good afternoon')
    expect(greeting(20)).toBe('Good evening')
  })
  it('shows the member their numbers and today\'s challenge', async () => {
    render(<DashboardPage />)
    expect(screen.getByText(/, Kaushik/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('What is a reverse proxy?')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('🔥 4')).toBeTruthy())
    expect(screen.getByText('1250')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()   // questions read
    expect(screen.getByText('Interview guides')).toBeTruthy()
  })
  it('asks a signed-out visitor to sign in', () => {
    isLoggedIn.mockReturnValue(false)
    render(<DashboardPage />)
    expect(screen.getByText('Sign in to see your dashboard')).toBeTruthy()
  })
})
