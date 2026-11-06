import { trackClick } from '../lib/analytics.js'

// Share links use this site's address; the web server forwards /share/* to the API (see the Caddyfile).
const SHARE_BASE = `${window.location.origin}/share`

// "Share on LinkedIn": opens LinkedIn's post composer with a ready-written post (editable before posting).
// The post ends with a /share link on this site, whose preview LinkedIn builds from server-made meta tags and picture:
// a question card, a company roadmap card, or the member's progress certificate.
//   <ShareLinkedIn question={q} />                  a question
//   <ShareLinkedIn company={{ id, name }} />        a company roadmap
//   <ShareLinkedIn progress={{ username, read, solved, streak, points }} />   "my progress" certificate
const hashtag = s => '#' + String(s || '').replace(/[^A-Za-z0-9]/g, '')

// LinkedIn posts need a useful preview, not the full (often long, Markdown-rich)
// answer. Prefer the first complete sentence and remove formatting/code first.
function answerTakeaway(answer) {
  const plain = String(answer || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return ''

  const firstSentence = plain.match(/^.{40,280}?[.!?](?:\s|$)/)?.[0]?.trim()
  if (firstSentence) return firstSentence
  return plain.length > 280 ? `${plain.slice(0, 280).trimEnd()}…` : plain
}

function post({ question, company, progress }) {
  if (question) {
    const topic = question.category || question.tech || 'tech'
    const takeaway = answerTakeaway(question.answer)
    return {
      link: `${SHARE_BASE}/q/${encodeURIComponent(question.id)}`,
      text: `💡 Interview question I'm revising today:\n\n“${question.question || question.title}”\n\n`
        + (takeaway ? `Key takeaway: ${takeaway}\n\n` : '')
        + `Found a clear answer with code and diagrams on Interview Reader. Worth a look if you're preparing too.\n\n`
        + `#InterviewPrep ${hashtag(topic)} #SoftwareEngineering #LearningInPublic`,
    }
  }
  if (company) {
    return {
      link: `${SHARE_BASE}/roadmap/${encodeURIComponent(company.id)}`,
      text: `🎯 Preparing for ${company.name} interviews.\n\n`
        + `I'm following a round-by-round roadmap on Interview Reader: the DSA topics, system design prompts and behavioral questions ${company.name} is known for.\n\n`
        + `#InterviewPrep ${hashtag(company.name)} #CareerGrowth #SoftwareEngineering`,
    }
  }
  const p = progress
  const bits = [p.read && `${p.read} interview questions read`, p.solved && `${p.solved} coding problems solved`,
    p.streak > 1 && `a ${p.streak}-day streak`, p.points && `${Number(p.points).toLocaleString('en-IN')} points`].filter(Boolean)
  return {
    link: `${SHARE_BASE}/u/${encodeURIComponent(p.username)}`,
    text: `🏅 My interview prep progress on Interview Reader${bits.length ? `: ${bits.join(', ')}` : ''}.\n\n`
      + `Small steps every day add up. Here's my certificate of progress 👇\n\n`
      + `#InterviewPrep #LearningInPublic #100DaysOfCode #SoftwareEngineering`,
  }
}

export function linkedInShareUrl(props) {
  const { link, text } = post(props)
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${text}\n\n${link}`)}`
}

export default function ShareLinkedIn({ question, company, progress, label = 'Share', className = '' }) {
  const iconOnly = !label
  const open = () => {
    trackClick(`share_linkedin:${question ? 'question' : company ? 'roadmap' : 'progress'}`)
    window.open(linkedInShareUrl({ question, company, progress }), 'linkedin-share', 'width=700,height=720,noopener')
  }
  return (
    <button type="button" onClick={open} title={iconOnly ? undefined : 'Share on LinkedIn'} data-tip={iconOnly ? 'Share on LinkedIn' : undefined} aria-label="Share on LinkedIn"
      className={iconOnly
        ? `reader-action-tooltip inline-flex items-center justify-center rounded-lg text-[#0a66c2] transition-colors hover:bg-[#0a66c2]/10 hover:text-[#004182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] focus-visible:ring-offset-2 dark:text-[#5aa5ef] dark:hover:bg-[#5aa5ef]/10 ${className}`
        : `inline-flex min-h-9 items-center gap-2 rounded-lg bg-gradient-to-b from-[#2077d4] to-[#0a66c2] px-3 text-sm font-semibold text-white shadow-md shadow-[#0a66c2]/30 ring-1 ring-inset ring-white/25 transition duration-200 hover:-translate-y-0.5 hover:from-[#0a66c2] hover:to-[#004182] hover:shadow-lg hover:shadow-[#0a66c2]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] focus-visible:ring-offset-2 active:translate-y-0 active:shadow-sm sm:min-h-11 sm:gap-2.5 sm:px-4 ${className}`}>
      <svg className={`${iconOnly ? 'h-6 w-6' : 'h-[18px] w-[18px]'} drop-shadow-sm`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
      </svg>
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
