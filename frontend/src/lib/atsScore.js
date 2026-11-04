// ATS (applicant tracking system) score for a resume, worked out in the browser from the resume's own data: nothing is sent anywhere.
// It checks what an ATS parser and a recruiter's keyword search look for: contact details, standard sections, role keywords, measurable
// results, strong verbs and sensible length. It is a guide, not a guarantee: real ATS products differ.

// Keyword banks per target role. Each entry is [display name, ...alternative spellings].
export const ROLES = {
  'java-backend': { label: 'Java Backend', keywords: [
    ['Java'], ['Spring Boot', 'springboot'], ['Spring'], ['Microservices', 'microservice'], ['REST API', 'RESTful', 'REST APIs'], ['Kafka', 'Apache Kafka'],
    ['PostgreSQL', 'postgres'], ['MySQL'], ['SQL'], ['Hibernate', 'JPA'], ['Redis'], ['Docker'], ['Kubernetes', 'k8s'], ['AWS'], ['CI/CD', 'CICD'], ['JUnit'],
    ['Mockito'], ['Maven', 'Gradle'], ['System design', 'distributed systems'], ['Concurrency', 'multithreading'], ['Git'], ['Agile', 'Scrum']] },
  frontend: { label: 'Frontend (React)', keywords: [
    ['React', 'React.js', 'reactjs'], ['JavaScript'], ['TypeScript'], ['HTML'], ['CSS'], ['Redux', 'Zustand'], ['Next.js', 'nextjs'], ['REST API', 'GraphQL'],
    ['Webpack', 'Vite'], ['Jest', 'React Testing Library', 'Cypress'], ['Responsive design', 'responsive'], ['Accessibility', 'WCAG', 'a11y'], ['Performance', 'Lighthouse', 'Core Web Vitals'],
    ['Tailwind', 'Sass', 'styled-components'], ['Git'], ['CI/CD'], ['Agile', 'Scrum'], ['Node.js', 'node']] },
  fullstack: { label: 'Full Stack', keywords: [
    ['React', 'Angular', 'Vue'], ['Node.js', 'node'], ['JavaScript'], ['TypeScript'], ['REST API', 'GraphQL'], ['SQL', 'PostgreSQL', 'MySQL'], ['MongoDB', 'NoSQL'],
    ['Docker'], ['AWS', 'Azure', 'GCP'], ['CI/CD'], ['Git'], ['Redis', 'caching'], ['Microservices'], ['Authentication', 'OAuth', 'JWT'], ['Testing', 'Jest', 'JUnit'],
    ['System design'], ['Agile', 'Scrum'], ['HTML'], ['CSS']] },
  'go-backend': { label: 'Go Backend', keywords: [
    ['Go', 'Golang'], ['gRPC'], ['REST API', 'RESTful'], ['Microservices'], ['PostgreSQL', 'MySQL', 'SQL'], ['Redis'], ['Kafka', 'RabbitMQ', 'NATS'], ['Docker'],
    ['Kubernetes', 'k8s'], ['Concurrency', 'goroutines', 'channels'], ['AWS', 'GCP'], ['CI/CD'], ['Prometheus', 'Grafana', 'observability'], ['Git'], ['System design', 'distributed systems'], ['Testing']] },
  general: { label: 'Software Engineer (general)', keywords: [
    ['Data structures', 'algorithms'], ['System design'], ['REST API'], ['SQL'], ['Git'], ['Docker'], ['AWS', 'Azure', 'GCP'], ['CI/CD'], ['Testing', 'unit tests'], ['Agile', 'Scrum'],
    ['Microservices'], ['Cloud']] },
}

const ACTION_VERBS = new Set(('built designed developed implemented led owned shipped delivered created launched migrated optimized optimised reduced improved increased cut ' +
  'automated architected refactored scaled integrated deployed maintained mentored reviewed analyzed analysed resolved streamlined established drove spearheaded engineered ' +
  'introduced replaced rebuilt extended raised wrote tested monitored configured collaborated coordinated planned managed produced achieved boosted accelerated').split(' '))
const STOP = new Set(('the and for with you are our will have has this that from your into their they them been being able such also more than other which while where what when who how ' +
  'including include includes within across using use used work working works team teams role roles skills skill experience experienced years year strong good great plus preferred ' +
  'required requirements responsibilities ability knowledge understanding etc looking join company candidate candidates position job').split(' '))

const clean = s => String(s || '').replace(/\*\*|__|`|\[([^\]]*)\]\([^)]*\)/g, '$1')
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const has = (text, term) => new RegExp(`(^|[^a-z0-9+#])${esc(term.toLowerCase())}($|[^a-z0-9+#])`).test(text)

function collect(d) {
  const bullets = []
  const parts = []
  const h = d.header || {}
  parts.push(h.name, h.headline, h.extra, h.location, d.summary)
  for (const s of d.skills || []) parts.push(s.label, s.value)
  for (const e of d.experience || []) { parts.push(e.role, e.company, e.meta); for (const b of e.bullets || []) if (String(b).trim()) { bullets.push(clean(b)); parts.push(b) } }
  for (const p of d.projects || []) { parts.push(p.name, p.tech); for (const b of p.bullets || []) if (String(b).trim()) { bullets.push(clean(b)); parts.push(b) } }
  for (const e of d.education || []) parts.push(e.degree, e.school)
  for (const a of d.achievements || []) parts.push(a)
  for (const c of d.custom || []) { parts.push(c.title, c.text); for (const b of c.bullets || []) parts.push(b) }
  return { text: clean(parts.filter(Boolean).join(' \n ')).toLowerCase(), bullets }
}

// Keywords from a pasted job description: the technical terms we know (any role) that it mentions, shown by the spelling the posting used,
// plus any other word it repeats (a tool we do not list, such as Terraform).
function keywordsFromJd(jd) {
  const t = jd.toLowerCase()
  const found = []
  const covered = new Set()
  for (const r of Object.values(ROLES)) for (const k of r.keywords) {
    if (covered.has(k[0].toLowerCase())) continue
    const hit = k.find(a => has(t, a))
    if (hit) { found.push(hit === k[0].toLowerCase() ? k : [k[0] === hit ? hit : hit, ...k]); k.forEach(a => covered.add(a.toLowerCase())) }
  }
  const freq = new Map()
  for (const w of t.match(/[a-z][a-z0-9+#.]{3,}/g) || []) { const x = w.replace(/\.+$/, ''); if (!STOP.has(x) && !covered.has(x) && x.length > 3) freq.set(x, (freq.get(x) || 0) + 1) }
  for (const [w] of [...freq].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6)) found.push([w.charAt(0).toUpperCase() + w.slice(1)])
  return found
}

export function atsScore(data, { role = 'java-backend', jd = '' } = {}) {
  const d = data || {}
  const { text, bullets } = collect(d)
  const h = d.header || {}
  const tips = []
  const rows = []
  const add = (label, points, max, tip) => { rows.push({ label, points: Math.round(points * 10) / 10, max }); if (tip && points < max * 0.7) tips.push(tip) }

  // 1. Contact details a parser must find (10)
  const links = (h.links || []).map(l => `${l.label} ${l.url}`.toLowerCase()).join(' ')
  const contact = (h.name?.trim() ? 3 : 0) + (/\S+@\S+\.\S+/.test(h.email || '') ? 3 : 0) + (String(h.phone || '').replace(/\D/g, '').length >= 8 ? 2 : 0) + (/linkedin|github/.test(links) ? 2 : 0)
  add('Contact details', contact, 10, 'Add your full name, email, phone and a LinkedIn or GitHub link at the top.')

  // 2. Standard sections (15)
  const sec = (d.summary?.trim() ? 3 : 0) + ((d.skills || []).length ? 4 : 0) + ((d.experience || []).length ? 4 : 0) + ((d.education || []).length ? 2 : 0) + ((d.projects || []).length ? 2 : 0)
  add('Standard sections', sec, 15, 'Include Summary, Skills, Experience and Education. ATS parsers look for these headings.')

  // 3. Keywords (40): the pasted job description if there is one, else the target role
  const target = jd.trim().length > 40 ? keywordsFromJd(jd) : ROLES[role]?.keywords || ROLES.general.keywords
  const matched = [], missing = []
  for (const k of target) (k.some(a => has(text, a)) ? matched : missing).push(k[0])
  const kw = target.length ? 40 * Math.min(1, matched.length / Math.max(1, Math.ceil(target.length * 0.85))) : 0
  add(jd.trim().length > 40 ? 'Match with the job description' : `Keywords for ${ROLES[role]?.label || 'the role'}`, kw, 40,
    missing.length ? `Add the keywords you genuinely have: ${missing.slice(0, 5).join(', ')}.` : '')

  // 4. Measurable results (15): share of bullets with a number
  const numeric = bullets.filter(b => /\d/.test(b)).length
  const impact = bullets.length ? 15 * Math.min(1, (numeric / bullets.length) / 0.5) : 0
  add('Measurable results', impact, 15, 'Put numbers in your bullets (%, time saved, users, requests per second). Aim for half of them.')

  // 5. Strong action verbs (10)
  const verbs = bullets.filter(b => ACTION_VERBS.has(b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, ''))).length
  const verb = bullets.length ? 10 * Math.min(1, (verbs / bullets.length) / 0.6) : 0
  add('Action verbs', verb, 10, 'Start bullets with a strong verb: Built, Designed, Led, Reduced, Migrated.')

  // 6. Length and bullet quality (10)
  const words = text.split(/\s+/).filter(Boolean).length
  const longBullets = bullets.filter(b => b.split(/\s+/).length > 40).length
  let len = 10
  if (words < 200) len -= 5; else if (words < 300) len -= 2; else if (words > 900) len -= 4
  if (longBullets > 0) len -= Math.min(3, longBullets)
  if (bullets.length < 4) len -= 3
  add('Length and clarity', Math.max(0, len), 10, words < 300 ? 'The resume is thin. Add detail to your experience and projects.' : words > 900 ? 'Over two pages of text. Trim to the most relevant points.' : 'Keep bullets under about 35 words.')

  const score = Math.round(rows.reduce((s, r) => s + r.points, 0))
  return { score, rows, matched, missing, tips: tips.slice(0, 5), words, bullets: bullets.length, usedJd: jd.trim().length > 40 }
}
