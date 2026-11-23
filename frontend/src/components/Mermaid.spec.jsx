import { describe, it, expect } from 'vitest'
import { normalizeDiagram } from './Mermaid.jsx'

describe('normalizeDiagram', () => {
  it('escapes ";" in sequence diagram messages', () => {
    const out = normalizeDiagram('sequenceDiagram\n  API->>DB: Atomic PENDING → ACCEPTED; insert edge')
    expect(out).toContain('PENDING --> ACCEPTED#59; insert edge')
  })
  it('leaves flowchart semicolons alone', () => {
    expect(normalizeDiagram('flowchart TD\n  A-->B;\n  B-->C;')).toBe('flowchart TD\n  A-->B;\n  B-->C;')
  })
})
