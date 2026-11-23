import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TechFilter } from './SidebarFilters.jsx'
import { techLabel, techBadge } from '../lib/badges.js'

const TECHS = ['java', 'react', 'node', 'sql', 'hld', 'kafka', 'golang', 'microservices', 'design-patterns', 'misc', 'angular', 'rails', 'aws', 'behavioral']

describe('TechFilter', () => {
  it('offers every technology including AWS, and reports the choice', async () => {
    const onChange = vi.fn()
    render(<TechFilter value="all" onChange={onChange} />)
    for (const name of ['All', 'Java', 'React', 'SQL', 'HLD', 'Go', 'Ruby on Rails', 'AWS', 'Behavioral'])
      expect(screen.getByRole('button', { name })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'AWS' }))
    expect(onChange).toHaveBeenCalledWith('aws')
  })
})

describe('tech labels and badges', () => {
  it('every technology has a readable label and its own badge colour', () => {
    for (const t of TECHS) {
      expect(techLabel(t)).toBeTruthy()
      expect(techBadge(t)).not.toBe(techBadge('unknown-tech'))
    }
    expect(techLabel('aws')).toBe('AWS')
  })
})
