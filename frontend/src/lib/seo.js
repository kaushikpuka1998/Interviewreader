// Per-question SEO: title, description, canonical, social cards and JSON-LD.
// The app is a SPA, so these are set on navigation — Googlebot renders JS and picks
// them up, but see docs/SEO.md for the prerender step that makes indexing faster.

const SITE_NAME = 'Interview Reader'
const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://interviewreader.cloud').replace(/\/+$/, '')

const TECH_NAMES = {
  java: 'Java', react: 'React', node: 'Node.js', sql: 'SQL', hld: 'System Design',
  golang: 'Go', kafka: 'Kafka', microservices: 'Microservices',
  'design-patterns': 'Design Patterns',
  angular: 'Angular', rails: 'Ruby on Rails', behavioral: 'Behavioral',
}

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Strip markdown to a clean sentence for the meta description. */
function plainText(md, max = 160) {
  const text = String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')      // code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')      // tables
    .replace(/[*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  // cut on a word boundary
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1'
function setRobots(noindex) {
  upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, follow' : ROBOTS_INDEX })
}

/** Fit a title into 60 chars: shorten the head on a word boundary, keep the suffix. */
function fitTitle(head, suffix, max = 60) {
  if (head.length + suffix.length <= max) return head + suffix
  const room = max - suffix.length - 1
  return head.slice(0, room).replace(/\s+\S*$/, '') + '…' + suffix
}

function setJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!data) { el?.remove(); return }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Apply SEO tags for the question being read.
 * `gated` marks members-only content, which Google supports via paywall
 * structured data (flexible sampling) — that is the sanctioned way to have
 * restricted content indexed without it counting as cloaking.
 */
export function setQuestionSeo(question, { gated = false } = {}) {
  if (!question) return

  const techName = TECH_NAMES[question.tech] || question.tech || ''
  const slug = document.location.pathname.replace(/^\/+/, '')
  const url = `${SITE_URL}/${slug}`
  const title = `${question.question || question.title} | ${techName} Interview Question`
  const description = plainText(question.answer)

  document.title = fitTitle(question.question || question.title, ` | ${techName} Interview Question`)
  setRobots(false)

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="keywords"]', {
    name: 'keywords',
    content: [techName, question.category, question.difficulty, 'interview questions', 'interview preparation']
      .filter(Boolean).join(', '),
  })
  upsertLink('canonical', url)

  // Open Graph / Twitter
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })

  // QAPage structured data — this is what produces rich results for Q&A content.
  const qa = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: question.question || question.title,
      text: question.question || question.title,
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: plainText(question.answer, 5000),
        url,
      },
    },
  }

  if (gated) {
    // Google's flexible-sampling markup: declares the page as restricted so the
    // gated body can be indexed legitimately rather than looking like cloaking.
    qa.isAccessibleForFree = false
    qa.hasPart = {
      '@type': 'WebPageElement',
      isAccessibleForFree: false,
      cssSelector: '.answer-content',
    }
  }
  setJsonLd('ld-qa', qa)

  // Breadcrumbs help Google show the topic in the result.
  setJsonLd('ld-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: `${techName} Interview Questions`, item: `${SITE_URL}/questions?tech=${question.tech}` },
      { '@type': 'ListItem', position: 3, name: question.title, item: url },
    ],
  })
}

/** Home / listing pages. */
export function setDefaultSeo(total) {
  const title = `${total ? total.toLocaleString() + '+ ' : ''}Interview Questions with Answers | ${SITE_NAME}`
  const description = 'Free interview questions and detailed answers for Java, React, Node.js, Go, SQL, System Design, Kafka and Microservices. Track your progress as you prepare.'
  document.title = title
  setRobots(false)
  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertLink('canonical', SITE_URL + '/')
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: SITE_URL + '/' })
  setJsonLd('ld-qa', {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  })
  setJsonLd('ld-breadcrumb', null)
}

/**
 * Title, description, canonical and social tags for the app's other public pages
 * (problem list, practice, leaderboard, resume builder). `jsonLd` adds structured data for that page.
 */
export function setPageSeo({ title, description, path, jsonLd, noindex = false }) {
  const url = `${SITE_URL}${path}`
  document.title = title
  setRobots(noindex) // thin utility pages (resume builder, leaderboard) are kept out of the index
  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertLink('canonical', url)
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  setJsonLd('ld-qa', jsonLd ? { ...jsonLd, url: jsonLd.url?.startsWith('/') ? SITE_URL + jsonLd.url : jsonLd.url } : null)
  setJsonLd('ld-breadcrumb', null)
}
