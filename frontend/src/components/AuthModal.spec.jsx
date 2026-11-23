import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/auth.js', () => ({
  login: vi.fn(), register: vi.fn(), googleSignIn: vi.fn(), fetchGoogleClientId: () => Promise.resolve(null),
}))
vi.mock('../lib/analytics.js', () => ({ trackClick: vi.fn(), flushEvents: vi.fn() }))
import AuthModal from './AuthModal.jsx'
import { login, register } from '../lib/auth.js'

const setup = (props = {}) => {
  const onSuccess = vi.fn(), onClose = vi.fn()
  render(<AuthModal onSuccess={onSuccess} onClose={onClose} {...props} />)
  return { onSuccess, onClose }
}
const fill = async (email, pw) => {
  await userEvent.type(screen.getByPlaceholderText('Email'), email)
  await userEvent.type(screen.getByPlaceholderText(/Password/), pw)
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

describe('AuthModal: sign up', () => {
  it('opens on sign up for a new visitor and on log in for a returning one', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy()
    document.body.innerHTML = ''
    localStorage.setItem('ir_had_account', '1')
    setup()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
  })

  it('keeps the button disabled until the Terms and age box is ticked', async () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Create free account' })
    expect(btn.disabled).toBe(true)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(btn.disabled).toBe(false)
  })

  it('registers an adult with the email, password and name, then reports success', async () => {
    register.mockResolvedValue({ email: 'a@b.com' })
    const { onSuccess } = setup()
    await userEvent.type(screen.getByPlaceholderText('Name (optional)'), 'Alice')
    await fill('a@b.com', 'secret1')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create free account' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ email: 'a@b.com' }))
    expect(register).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1', name: 'Alice', termsAccepted: true, adult: true })
    expect(localStorage.getItem('ir_had_account')).toBe('1')
  })

  it('asks for a guardian when "Under 18?" is chosen and needs their consent', async () => {
    register.mockResolvedValue({})
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Under 18?' }))
    expect(screen.getByText('Parent or guardian consent needed')).toBeTruthy()
    await fill('kid@b.com', 'secret1')
    await userEvent.type(screen.getByPlaceholderText("Parent or guardian's name"), 'Mum')
    await userEvent.type(screen.getByPlaceholderText("Parent or guardian's email"), 'mum@b.com')
    const [terms, consent] = screen.getAllByRole('checkbox').reverse()   // terms box is below the guardian box
    await userEvent.click(terms)
    const btn = screen.getByRole('button', { name: 'Create free account' })
    expect(btn.disabled).toBe(true)
    await userEvent.click(consent)
    expect(btn.disabled).toBe(false)
  })

  it('shows the server error and stays open', async () => {
    register.mockRejectedValue(new Error('Email already registered'))
    const { onSuccess } = setup()
    await fill('a@b.com', 'secret1')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create free account' }))
    expect(await screen.findByText('Email already registered')).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('can show the terms inline', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Read terms' }))
    expect(screen.getByRole('heading', { name: 'Returns and refunds' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Hide terms' }))
    expect(screen.queryByRole('heading', { name: 'Returns and refunds' })).toBeNull()
  })
})

describe('AuthModal: log in', () => {
  beforeEach(() => localStorage.setItem('ir_had_account', '1'))

  it('logs in with the typed credentials', async () => {
    login.mockResolvedValue({ email: 'a@b.com' })
    const { onSuccess } = setup()
    await fill('a@b.com', 'secret1')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1' })
  })

  it('shows "Invalid email or password" on a bad login', async () => {
    login.mockRejectedValue(new Error('Invalid email or password'))
    setup()
    await fill('a@b.com', 'wrong12')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('Invalid email or password')).toBeTruthy()
  })

  it('toggles password visibility', async () => {
    setup()
    const input = screen.getByPlaceholderText(/Password/)
    expect(input.type).toBe('password')
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input.type).toBe('text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input.type).toBe('password')
  })

  it('switches between log in, sign up and forgot password', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Back to login/ }))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
  })

  it('sends a reset link and shows the confirmation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ message: 'If that email is registered, a reset link has been sent' }) })
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/reset link has been sent/)).toBeTruthy()
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/auth\/forgot-password$/)
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ email: 'a@b.com' })
  })

  it('closes from the X button', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
