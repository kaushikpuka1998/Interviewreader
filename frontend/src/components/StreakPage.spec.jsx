import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./TopBar.jsx', () => ({ default: () => null }))
vi.mock('./Footer.jsx', () => ({ default: () => null }))
vi.mock('./AuthModal.jsx', () => ({ default: () => null }))
vi.mock('./LeagueBadge.jsx', () => ({ default: () => null }))
vi.mock('../lib/seo.js', () => ({ setPageSeo: vi.fn() }))
vi.mock('../lib/auth.js', () => ({ isLoggedIn: vi.fn(() => true) }))
vi.mock('../lib/points.js', () => ({ fetchPoints: vi.fn(), fetchPointHistory: vi.fn() }))
import StreakPage from './StreakPage.jsx'
import { isLoggedIn } from '../lib/auth.js'
import { fetchPoints, fetchPointHistory } from '../lib/points.js'

const istDay = offset => new Date(Date.now() + 5.5 * 3600e3 - offset * 864e5).toISOString().slice(0, 10)

beforeEach(() => {
  vi.clearAllMocks()
  isLoggedIn.mockReturnValue(true)
  fetchPoints.mockResolvedValue({ streak: 20, best: 20, rules: {}, weekBreakdown: {} })
})

describe('StreakPage calendar', () => {
  it('asks signed-out visitors to sign in', () => {
    isLoggedIn.mockReturnValue(false)
    render(<StreakPage />)
    expect(screen.getByRole('heading', { name: 'Sign in to see your streak' })).toBeTruthy()
  })

  it('shows the streak number and marks checked-in days with a flame', async () => {
    fetchPointHistory.mockResolvedValue({ events: [], days: [istDay(0), istDay(1)], frozen: [] })
    render(<StreakPage />)
    expect(await screen.findByText(/🔥 20/)).toBeTruthy()
    await vi.waitFor(() => expect(screen.getAllByText('🔥').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByText('❄️')).toBeNull()
    expect(screen.queryByText(/streak freeze/)).toBeNull()
  })

  it('marks a day covered by a Premium streak freeze with a snowflake and explains it', async () => {
    fetchPointHistory.mockResolvedValue({ events: [], days: [istDay(0), istDay(2)], frozen: [istDay(1)] })
    render(<StreakPage />)
    const flake = await screen.findByText('❄️')
    expect(flake.getAttribute('title')).toContain('streak freeze used (Premium)')
    expect(screen.getByText(/A missed day covered by your Premium streak freeze/)).toBeTruthy()
  })

  it('a day with no check-in and no freeze shows its date number, not a flame', async () => {
    fetchPointHistory.mockResolvedValue({ events: [], days: [istDay(0)], frozen: [] })
    render(<StreakPage />)
    await screen.findByText(/🔥 20/)
    const missed = istDay(3)
    await vi.waitFor(() => expect(screen.getAllByText(String(Number(missed.slice(8)))).length).toBeGreaterThan(0))
  })
})
