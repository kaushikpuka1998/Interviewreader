import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HldGroupedList from './HldGroupedList.jsx'

const items = [
  { id: 1, title: 'Design WhatsApp.', done: true },
  { id: 2, title: 'Design Slack', done: false },
  { id: 3, title: 'Design Uber.', done: false },
]
const setup = (props = {}) => render(<HldGroupedList items={items} isDone={x => x.done} renderItem={x => <span>{x.title}</span>} {...props} />)

describe('HldGroupedList', () => {
  it('shows each group with its done/total count, collapsed at first', () => {
    setup()
    expect(screen.getByRole('button', { name: /Chat & Presence/ })).toBeTruthy()
    expect(screen.getByLabelText('1 of 2 done')).toBeTruthy()
    expect(screen.getByLabelText('0 of 1 done')).toBeTruthy()
    expect(screen.queryByText('Design WhatsApp.')).toBeNull()
  })

  it('opens and closes a group', async () => {
    setup()
    const head = screen.getByRole('button', { name: /Chat & Presence/ })
    await userEvent.click(head)
    expect(screen.getByText('Design WhatsApp.')).toBeTruthy()
    expect(screen.getByText('Design Slack')).toBeTruthy()
    expect(screen.queryByText('Design Uber.')).toBeNull()
    await userEvent.click(head)
    expect(screen.queryByText('Design WhatsApp.')).toBeNull()
  })

  it('can collapse the group that opened because it holds the active question', async () => {
    setup({ activeId: 3 })
    expect(screen.getByText('Design Uber.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Maps, Rides & Dispatch/ }))
    expect(screen.queryByText('Design Uber.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Maps, Rides & Dispatch/ }))
    expect(screen.getByText('Design Uber.')).toBeTruthy()
  })

  it('opens the group of the active question and every group while searching', () => {
    const { unmount } = setup({ activeId: 3 })
    expect(screen.getByText('Design Uber.')).toBeTruthy()
    expect(screen.queryByText('Design Slack')).toBeNull()
    unmount()
    setup({ forceOpen: true })
    expect(screen.getByText('Design Slack')).toBeTruthy()
    expect(screen.getByText('Design Uber.')).toBeTruthy()
  })

  it('opens the group of a question that becomes active later', () => {
    const { rerender } = setup({ activeId: 1 })
    expect(screen.queryByText('Design Uber.')).toBeNull()
    rerender(<HldGroupedList items={items} isDone={x => x.done} renderItem={x => <span>{x.title}</span>} activeId={3} />)
    expect(screen.getByText('Design Uber.')).toBeTruthy()
    expect(screen.getByText('Design WhatsApp.')).toBeTruthy()   // the first group stays open
  })
})
