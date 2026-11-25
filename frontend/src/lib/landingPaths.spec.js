import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { LANDING_PATHS, isLandingPath } from './landingPaths.js'

// A page in the backend's landing-pages.json that the app does not route would show the reader's 404; a routed path with no page, a blank page.
describe('landing pages', () => {
  // Tests run from the repo root (CI) or from frontend/.
  const file = ['backend', '../backend'].map(d => resolve(process.cwd(), d, 'src/main/resources/landing-pages.json')).find(existsSync)
  const pages = JSON.parse(readFileSync(file, 'utf8'))
  const backend = pages.map(p => p.path)
  it('the app routes exactly the pages the backend serves', () => {
    expect([...LANDING_PATHS].sort()).toEqual([...backend].sort())
  })
  it('every page has text, a title under 80 characters and no duplicate path', () => {
    expect(new Set(backend).size).toBe(backend.length)
    for (const p of pages) { expect(p.intro?.length).toBeGreaterThan(0); expect(p.title.length).toBeLessThan(80); expect(p.faq?.length).toBeGreaterThan(0) }
  })
})

describe('generated landing page paths', () => {
  it('recognises the company, topic and difficulty page shapes', () => {
    for (const p of ['/companies/acme-corp/coding-interview-questions', '/companies/acme-corp/array-problems', '/companies/acme-corp/basic-problems', '/dsa/heap-priority-queue', '/dsa/array/advanced', '/companies/amazon/sde-2'])
      expect(isLandingPath(p), p).toBe(true)
  })
  it('leaves everything else to the app', () => {
    for (const p of ['/', '/companies', '/dsa', '/dsa/array/hard/extra', '/companies/acme/unknown', '/what-is-a-reverse-proxy']) expect(isLandingPath(p), p).toBe(false)
  })
})
