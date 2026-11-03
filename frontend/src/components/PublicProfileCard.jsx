import Pic from './Pic.jsx'

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.02 1.76 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" /></svg>
)
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" /></svg>
)
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
)

// Each skill gets one of a few quiet tints, by position, so the row has rhythm without a colour per technology.
const TINTS = [
  'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
]

const rel = 'noopener noreferrer nofollow ugc'
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }

// The identity card at the top of a public profile: a cover strip, the member's picture straddling its edge, their headline and a short
// description, then where they studied and where to find them, and their skills. Only what the member filled in is drawn.
export default function PublicProfileCard({ profile }) {
  const d = profile.details || {}
  const initial = profile.name.trim().charAt(0).toUpperCase()
  const links = [
    d.github && { href: `https://github.com/${encodeURIComponent(d.github)}`, label: d.github, icon: <GitHubIcon />, cls: 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white' },
    d.linkedin && { href: `https://www.linkedin.com/in/${encodeURIComponent(d.linkedin)}`, label: 'LinkedIn', icon: <LinkedInIcon />, cls: 'bg-[#0a66c2] text-white hover:bg-[#004182]' },
    d.website && { href: d.website, label: hostOf(d.website), icon: <GlobeIcon />, cls: 'border border-emerald-600/40 bg-white text-emerald-800 hover:bg-emerald-50 dark:border-emerald-400/40 dark:bg-transparent dark:text-emerald-200 dark:hover:bg-emerald-500/10' },
  ].filter(Boolean)

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-lg shadow-emerald-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none" aria-label="About this member">
      <div className="relative h-16 bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.28)_1px,transparent_0)] [background-size:14px_14px]" aria-hidden="true" />
        <a href="/" className="absolute right-4 top-3 z-10 text-xs font-semibold text-white/90 hover:text-white hover:underline">← Interview Reader</a>
      </div>
      <div className="grid gap-x-6 gap-y-4 px-5 pb-5 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 gap-4">
          <div className="relative z-10 -mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white shadow-md ring-4 ring-white dark:ring-slate-950">
            <Pic src={profile.picture} fallback={initial} />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="truncate text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{profile.name}</h1>
            {d.headline && <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{d.headline}</p>}
            <p className="text-xs text-slate-600 dark:text-slate-400">Interview Reader member{profile.memberSince ? ` since ${new Date(profile.memberSince).toLocaleDateString()}` : ''}</p>
          </div>
        </div>
        {(d.college || links.length > 0) && (
          <div className="flex flex-col gap-2 lg:items-end">
            {d.college && (
              <div className="rounded-xl border border-dashed border-emerald-700/30 px-3 py-1.5 text-left dark:border-slate-600 lg:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Studied at</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d.college}</p>
              </div>
            )}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {links.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel={rel} data-track="public_profile_link"
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${l.cls}`}>
                    {l.icon}{l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        {d.bio && <p className="border-l-4 border-emerald-500/60 pl-3 text-sm italic leading-relaxed text-slate-700 dark:text-slate-300 lg:col-span-2">{d.bio}</p>}
        {d.skills?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 lg:col-span-2" aria-label="Skills">
            {d.skills.map((s, i) => <li key={s} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${TINTS[i % TINTS.length]}`}>{s}</li>)}
          </ul>
        )}
      </div>
    </section>
  )
}
