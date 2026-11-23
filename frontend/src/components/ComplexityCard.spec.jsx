import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ComplexityCard from './ComplexityCard.jsx'

describe('ComplexityCard', () => {
  it('shows the estimate and the curve graph for nested loops', () => {
    render(<ComplexityCard language="python" code={'def f(a):\n  for i in range(len(a)):\n    for j in range(len(a)):\n      pass'} />)
    expect(screen.getByText('Time O(n²)')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Growth curves with O\(n²\) highlighted/ })).toBeTruthy()
  })
  it('says constant work when there are no loops', () => {
    render(<ComplexityCard language="python" code={'def f(n):\n  return n'} />)
    expect(screen.getByText('Time O(1)')).toBeTruthy()
    expect(screen.getByText(/No loops or recursion found/)).toBeTruthy()
  })
})
