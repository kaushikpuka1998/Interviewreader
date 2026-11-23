import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../lib/engage.js', () => ({ fetchReferral: vi.fn(), fetchRevisionDue: vi.fn(), markRevised: vi.fn() }))
import { ReferralCard } from './ProfileGrowth.jsx'
import { fetchReferral } from '../lib/engage.js'

const base = { code: 'abc23xyz', link: 'https://x.test/?ref=abc23xyz', rewardDays: 7, perReward: 3, maxRewards: 10 }

beforeEach(() => vi.clearAllMocks())

describe('ReferralCard', () => {
  it('explains the 3-for-7 rule and the friend bonus', async () => {
    fetchReferral.mockResolvedValue({ ...base, joined: 0, daysEarned: 0, nextRewardIn: 3 })
    render(<ReferralCard />)
    expect(await screen.findByText('Invite 3 friends, get 7 days of Premium')).toBeTruthy()
    expect(screen.getByText(/Every friend who joins with your link also gets 7 days/)).toBeTruthy()
    expect(screen.getByLabelText('Your invite link').value).toBe(base.link)
  })

  it('shows how many more friends are needed', async () => {
    fetchReferral.mockResolvedValue({ ...base, joined: 1, daysEarned: 0, nextRewardIn: 2 })
    render(<ReferralCard />)
    expect(await screen.findByText('2 more friends to earn 7 days of Premium.')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
  })

  it('uses the singular for the last friend and counts earned days', async () => {
    fetchReferral.mockResolvedValue({ ...base, joined: 5, daysEarned: 7, nextRewardIn: 1 })
    render(<ReferralCard />)
    expect(await screen.findByText('1 more friend to earn 7 days of Premium.')).toBeTruthy()
    expect(screen.getByText(/5 friends joined · 7 days earned/)).toBeTruthy()
  })

  it('says everything is earned at the cap', async () => {
    fetchReferral.mockResolvedValue({ ...base, joined: 30, daysEarned: 70, nextRewardIn: 0 })
    render(<ReferralCard />)
    expect(await screen.findByText('You have earned every reward.')).toBeTruthy()
  })
})
