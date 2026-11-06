import { useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import { fetchQotd } from '../lib/engage.js'
import { fetchQuestion } from '../lib/api.js'

const SHARE_BASE = `${window.location.origin}/share`

function cleanTakeaway(answer) {
  const text = String(answer || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = text.match(/^.{45,260}?[.!?](?:\s|$)/)?.[0]?.trim()
  return sentence || (text.length > 260 ? `${text.slice(0, 260).trimEnd()}…` : text)
}

function makePost(question, angle) {
  if (!question) return ''
  const title = question.question || question.title
  const takeaway = cleanTakeaway(question.answer) || 'It helped me turn a broad interview concept into a practical, memorable framework.'
  const link = `${SHARE_BASE}/q/${encodeURIComponent(question.id)}`
  const topic = String(question.tech || question.category || 'InterviewPrep').replace(/[^a-z0-9]/gi, '')
  const opening = {
    insight: `A small interview-prep insight I’m taking with me today:`,
    learning: `Today’s interview-prep session gave me a useful reminder:`,
    challenge: `I challenged myself to explain this without memorising a script:`,
  }[angle]
  const reflection = {
    insight: `The key idea: ${takeaway}`,
    learning: `My takeaway: ${takeaway}`,
    challenge: `What clicked for me: ${takeaway}`,
  }[angle]
  return `${opening}\n\n“${title}”\n\n${reflection}\n\nI’m sharing this as part of a habit of learning in public—one concept at a time. How would you explain it in an interview?\n\n${link}\n\n#InterviewPrep #SoftwareEngineering #LearningInPublic #${topic}`
}

export default function LinkedInPostStudio() {
  const [question, setQuestion] = useState(null)
  const [angle, setAngle] = useState('insight')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [image, setImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [publishHint, setPublishHint] = useState(false)
  const imageInputRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchQotd()
      .then(daily => daily?.id ? fetchQuestion(daily.id) : null)
      .then(full => { if (active) setQuestion(full) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const generated = useMemo(() => makePost(question, angle), [question, angle])
  useEffect(() => { setDraft(generated) }, [generated])
  useEffect(() => () => { if (image?.url) URL.revokeObjectURL(image.url) }, [image])

  const chooseImage = file => {
    setImageError('')
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setImageError('Choose a PNG, JPG, or WebP image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Choose an image smaller than 10 MB.')
      return
    }
    setImage({ file, url: URL.createObjectURL(file) })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }
  const publish = async () => {
    try { await navigator.clipboard.writeText(draft) } catch { /* LinkedIn receives the text through its share URL as well. */ }
    setPublishHint(!!image)
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(draft)}`
    window.open(url, 'linkedin-post', 'width=700,height=720,noopener')
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-900">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0a66c2]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.13em] text-[#075aa9] dark:bg-[#5aa5ef]/15 dark:text-[#9bc9f5]">in · Post Studio</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Share what you learned today.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">Turn today’s interview question into a thoughtful LinkedIn post. Choose an angle, make it your own, then copy or publish when it feels right.</p>
        </div>

        <section className="mx-auto mt-8 grid max-w-5xl gap-5 lg:grid-cols-[0.8fr_1.2fr]" aria-label="LinkedIn post generator">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Today’s source</p>
            {loading ? <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /> : question ? <>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">{question.question || question.title}</p>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Choose your angle</p>
                <div className="mt-2 space-y-2" role="radiogroup" aria-label="Post angle">
                  {[
                    ['insight', 'Share an insight', 'Lead with a useful takeaway.'],
                    ['learning', 'Learning in public', 'Frame it as part of your journey.'],
                    ['challenge', 'Start a discussion', 'Invite others to share their approach.'],
                  ].map(([value, label, detail]) => <button key={value} type="button" role="radio" aria-checked={angle === value} onClick={() => setAngle(value)} className={`w-full rounded-xl border p-3 text-left transition ${angle === value ? 'border-[#0a66c2] bg-[#0a66c2]/5 shadow-sm dark:border-[#5aa5ef] dark:bg-[#5aa5ef]/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`}>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{label}</span><span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{detail}</span>
                  </button>)}
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">Add an image</p>{image && <button type="button" onClick={() => setImage(null)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300">Remove</button>}</div>
                {image ? <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><img src={image.url} alt="Selected post image preview" className="max-h-44 w-full object-cover" /><div className="flex items-center justify-between gap-2 px-3 py-2"><span className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">{image.file.name}</span><a href={image.url} download={image.file.name} className="shrink-0 text-xs font-bold text-[#075aa9] hover:underline dark:text-[#9bc9f5]">Download</a></div></div> : <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseImage(e.dataTransfer.files?.[0]) }} className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-600 dark:bg-slate-900/60"><span className="text-xl" aria-hidden="true">🖼️</span><p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Use a visual to make the post more personal</p><button type="button" onClick={() => imageInputRef.current?.click()} className="mt-2 text-xs font-bold text-[#075aa9] hover:underline dark:text-[#9bc9f5]">Choose image</button><input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => chooseImage(e.target.files?.[0])} className="sr-only" /></div>}
                {imageError && <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{imageError}</p>}
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">PNG, JPG, or WebP · up to 10 MB</p>
              </div>
            </> : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Today’s question could not be loaded. Try refreshing the page.</p>}
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-950 dark:shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div><p className="text-sm font-bold text-slate-900 dark:text-white">Your post draft</p><p className="text-xs text-slate-500 dark:text-slate-400">Edit before you publish—it should sound like you.</p></div>
              <span className="rounded-full bg-[#0a66c2]/10 px-2.5 py-1 text-xs font-bold text-[#075aa9] dark:bg-[#5aa5ef]/15 dark:text-[#9bc9f5]">LinkedIn ready</span>
            </div>
            <div className="p-4 sm:p-5">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} disabled={!question} className="min-h-[350px] w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" aria-label="Edit LinkedIn post draft" />
              <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">{draft.length.toLocaleString()} characters · Short, specific posts tend to be easier to read.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={copy} disabled={!draft} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{copied ? 'Copied!' : 'Copy post'}</button>
                  <button type="button" onClick={publish} disabled={!draft} className="min-h-10 rounded-lg bg-[#0a66c2] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-50">Publish on LinkedIn ↗</button>
                </div>
              </div>
              {publishHint && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">Your caption was copied and LinkedIn was opened. In LinkedIn, choose <b>Add media</b> and select the image above (or download it first) to attach it to this post.</p>}
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  )
}
