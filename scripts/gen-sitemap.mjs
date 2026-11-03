#!/usr/bin/env node
/**
 * Generates frontend/public/sitemap.xml and robots.txt from the live question list.
 *
 * The sitemap must live on the same host as the URLs it lists, which is the
 * frontend origin — so it is written into public/ and shipped with the build
 * rather than served from the API.
 *
 *   API_BASE=https://api.example.com/api SITE_URL=https://example.com \
 *     node scripts/gen-sitemap.mjs
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPANY_GROUPS, groupOf } from '../frontend/src/lib/companyGroups.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// The backend has its own host; interviewreader.cloud/api is the frontend and answers every path with index.html.
const API_BASE = process.env.API_BASE || 'https://api.interviewreader.cloud/api'
// /questions/index lists every question (gated topics included, no answers), so no token is needed.
// AUTH_TOKEN is only used by the old paged fallback for backends that don't have the index yet.
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
const SITE_URL = (process.env.SITE_URL || 'https://interviewreader.cloud').replace(/\/+$/, '')
const PAGE_SIZE = 500

// Must match frontend/src/lib/slug.js exactly, or the sitemap points at 404s.
const slugify = (text) =>
  String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Public pages besides the question reader: [path, changefreq, priority].
const STATIC_PAGES = [
  ['/problems', 'daily', '0.9'],
  ['/roadmaps', 'weekly', '0.9'],
  ['/question-of-the-day', 'daily', '0.8'],
  ['/discuss', 'daily', '0.7'],
  ['/premium', 'monthly', '0.7'],
  ['/practice', 'weekly', '0.7'],
  ['/interview', 'weekly', '0.7'],
  ['/terms', 'yearly', '0.2'],
]

async function fetchAll() {
  // Preferred: one call that returns every question's slug and last change.
  try {
    const index = await fetchJson('/questions/index')
    console.log(`Question index: ${index.length} questions`)
    return index.map(e => ({ question: e.slug, _isSlug: true, updatedAt: e.lastmod || undefined, id: e.id }))
  } catch (err) {
    console.warn(`/questions/index unavailable (${err.message}).`)
    console.warn('  Deploy the backend with the question index to list every question; using the paged list for now.')
  }
  const out = []
  try {
    for (let page = 0; ; page++) {
      const data = await fetchJson(`/questions?page=${page}&size=${PAGE_SIZE}`, AUTH_TOKEN ? { Cookie: `token=${AUTH_TOKEN}` } : {})
      out.push(...(data.content || []))
      if (!data.totalPages || page + 1 >= data.totalPages) break
    }
  } catch (err) {
    console.warn(`Could not reach ${API_BASE} (${err.message}) — falling back to existing sitemap entries`)
    try {
      const existing = await readFile(join(ROOT, 'frontend', 'public', 'sitemap.xml'), 'utf8')
      const matches = [...existing.matchAll(/<loc>https?:\/\/[^/]+\/([^<]+)<\/loc>/g)]
      const reserved = new Set(['', ...STATIC_PAGES.map(([p]) => p.slice(1))])
      const fallbackSlugs = matches.map(m => m[1]).filter(s => !reserved.has(s))
      if (fallbackSlugs.length > 0) {
        console.log(`Using ${fallbackSlugs.length} cached questions from existing sitemap.xml`)
        return fallbackSlugs.map(slug => ({ question: slug, _isSlug: true }))
      }
    } catch {}
    throw err
  }
  return out
}

// Landing pages beyond the question reader, built from live data: every coding problem, every company's
// problem list, each company type (FAANG, Big 4, ...) and each company roadmap. Each sets its own canonical.
async function fetchJson(path, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  if (!(res.headers.get('content-type') || '').includes('json'))
    throw new Error(`${API_BASE}${path} returned ${res.headers.get('content-type') || 'no content type'}, not JSON. Is API_BASE the backend?`)
  return res.json()
}

async function landingPages() {
  const pages = []   // [path, changefreq, priority, lastmod?]
  try {
    const problems = await fetchJson('/coding-problems')
    for (const p of problems) pages.push([`/practice?id=${p.id}`, 'monthly', '0.7', p.createdAt])
    const companies = await fetchJson('/coding-problems/companies')
    for (const c of companies) pages.push([`/problems?company=${encodeURIComponent(c.name)}`, 'weekly', '0.7'])
    // Company types: a type is listed only if at least one problem is asked by a company in it.
    const usedSub = new Set(problems.flatMap(p => (p.companies || []).map(c => groupOf(c).subgroup)))
    for (const g of COMPANY_GROUPS) {
      const subs = g.subgroups.filter(sg => usedSub.has(sg.id))
      if (!subs.length) continue
      pages.push([`/problems?group=${g.id}`, 'weekly', '0.7'])
      for (const sg of subs) pages.push([`/problems?group=${g.id}&sub=${sg.id}`, 'weekly', '0.7'])
    }
    console.log(`Coding: ${problems.length} problems, ${companies.length} companies`)
  } catch (err) {
    console.warn(`Coding problem pages skipped (${err.message})`)
  }
  try {
    const roadmap = await fetchJson('/roadmaps')
    for (const c of roadmap.companies || []) pages.push([`/roadmaps?company=${c.id}`, 'weekly', '0.8'])
  } catch (err) {
    console.warn(`Roadmap pages skipped (${err.message})`)
  }
  return pages
}

function sitemapXml(questions, extraPages = []) {
  const today = new Date().toISOString().slice(0, 10)
  // Questions with identical titles share a slug; list each URL once (the reader opens the first match).
  const seen = new Set()
  const urls = [
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    // The app's other public pages.
    ...[...STATIC_PAGES, ...extraPages].map(([path, freq, prio, lastmod]) =>
      lastmod
        ? `  <url>\n    <loc>${xmlEscape(SITE_URL + path)}</loc>\n    <lastmod>${String(lastmod).slice(0, 10)}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`
        :
      `  <url>\n    <loc>${xmlEscape(SITE_URL + path)}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`),
    ...questions.map(q => {
      const slug = q._isSlug ? q.question : slugify(q.question || q.title)
      if (!slug || seen.has(slug)) return null
      seen.add(slug)
      return `  <url>
    <loc>${xmlEscape(`${SITE_URL}/${slug}`)}</loc>
    <lastmod>${(q.updatedAt || q.createdAt || today).toString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    }).filter(Boolean),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

const robotsTxt = () => `# ${SITE_URL}
User-agent: *
Allow: /

# Application routes with no standalone content
Disallow: /admin
Disallow: /profile
Disallow: /u/

Sitemap: ${SITE_URL}/sitemap.xml
`

async function main() {
  const questions = await fetchAll()
  const publicDir = join(ROOT, 'frontend', 'public')
  await mkdir(publicDir, { recursive: true })

  const xml = sitemapXml(questions, await landingPages())
  await writeFile(join(publicDir, 'sitemap.xml'), xml)
  await writeFile(join(publicDir, 'robots.txt'), robotsTxt())

  console.log(`sitemap.xml  ${xml.split('<url>').length - 1} urls`)
  console.log(`robots.txt   -> ${SITE_URL}/sitemap.xml`)
  if (questions.length >= 50000) {
    console.warn('WARNING: over 50,000 urls — split into a sitemap index.')
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
