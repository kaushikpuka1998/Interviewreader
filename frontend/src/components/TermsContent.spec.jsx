import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TermsContent from './TermsContent.jsx'

describe('TermsContent', () => {
  it('names the service and keeps the legally required sections', () => {
    render(<TermsContent />)
    expect(screen.getByText(/Interview Reader \(also written InterviewReader/)).toBeTruthy()
    for (const h of ['What we collect', 'Returns and refunds', 'Deleting your data', 'Grievance officer', 'Premium passes'])
      expect(screen.getByRole('heading', { name: h })).toBeTruthy()
  })
})
