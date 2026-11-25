import { describe, it, expect } from 'vitest'
import { setQuestionSeo } from './seo.js'

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content')
const q = { title: 'What is a reverse proxy?', tech: 'hld', answer: 'A reverse proxy sits in front of servers.' }

describe('question page indexing', () => {
  it('keeps a members-only question (no answer shown) out of the index', () => {
    setQuestionSeo(q, { gated: true })
    expect(robots()).toMatch(/^noindex/)
  })
  it('indexes a question whose answer is readable', () => {
    setQuestionSeo(q, { gated: false })
    expect(robots()).toMatch(/^index/)
  })
})
