import { useState } from 'react'
import Mermaid from './Mermaid.jsx'
import ImageLightbox from './ImageLightbox.jsx'

// ponytail: regex tokenizer, covers Java/JS/TS/Go well enough; swap for Shiki if more langs needed
const KEYWORDS = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var let function async await yield typeof of in delete null true false undefined NaN chan defer fallthrough func go map range select struct type nil iota make append copy panic recover len cap string error any rune uint int64 int32 float64 bool def elif except raise lambda pass None True False self'.split(' '))

// Languages that are prose/diagram rather than code — highlighting them looks wrong.
const PLAIN_LANGS = new Set(['mermaid', 'text', 'txt', 'plain', 'diagram', ''])

function highlightCode(code) {
  // token regex: comments | strings | numbers | annotations | identifiers | other
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(@\w+)|(\b\d[\d.xXa-fA-F_]*\b)|(\b[A-Za-z_$][\w$]*\b)/g
  const out = []
  let last = 0, m, k = 0
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    const key = k++
    if (m[1]) out.push(<span key={key} className="text-slate-500 italic">{m[1]}</span>)
    else if (m[2]) out.push(<span key={key} className="text-emerald-400">{m[2]}</span>)
    else if (m[3]) out.push(<span key={key} className="text-amber-400">{m[3]}</span>)
    else if (m[4]) out.push(<span key={key} className="text-orange-400">{m[4]}</span>)
    else if (m[5]) {
      const w = m[5]
      if (KEYWORDS.has(w)) out.push(<span key={key} className="text-purple-400 font-medium">{w}</span>)
      else if (/^[A-Z]/.test(w)) out.push(<span key={key} className="text-cyan-300">{w}</span>)
      else if (code[re.lastIndex] === '(') out.push(<span key={key} className="text-blue-400">{w}</span>)
      else out.push(w)
    }
    last = re.lastIndex
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

function formatInline(line) {
  // Order matters: images before links, links before emphasis.
  const chunks = String(line).split(/(!?\[[^\]]*\]\([^)]*\)|`+[^`]+`+|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g)
  return chunks.map((chunk, index) => {
    if (!chunk) return null
    // Inline image: ![alt](src)
    if (chunk.startsWith('![')) {
      const m = chunk.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/)
      if (m) return <img key={index} src={m[2]} alt={m[1]} title={m[3]} className="inline-block max-w-full h-auto rounded" loading="lazy" />
    }
    // Link: [text](href) — anchors stay in-page, external links open in a new tab
    if (chunk.startsWith('[')) {
      const m = chunk.match(/^\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/)
      if (m) {
        const href = m[2]
        const isAnchor = href.startsWith('#')
        return (
          <a
            key={index}
            href={href}
            title={m[3]}
            {...(isAnchor ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="text-blue-600 dark:text-blue-400 hover:underline break-words"
          >
            {formatInline(m[1])}
          </a>
        )
      }
    }
    // Any run of backticks opens/closes inline code (``` inline, or unbalanced ```` from source data).
    if (chunk.startsWith('`') && chunk.endsWith('`')) return <code key={index} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-slate-900 dark:text-slate-100 break-words">{chunk.replace(/^`+|`+$/g, '').trim()}</code>
    if (chunk.startsWith('**') && chunk.endsWith('**')) return <strong key={index} className="font-semibold text-slate-900 dark:text-slate-100">{chunk.slice(2, -2)}</strong>
    if (chunk.startsWith('*') && chunk.endsWith('*')) return <em key={index} className="italic text-slate-700 dark:text-slate-300">{chunk.slice(1, -1)}</em>
    if (chunk.startsWith('~~') && chunk.endsWith('~~')) return <del key={index} className="line-through text-slate-500 dark:text-slate-400">{chunk.slice(2, -2)}</del>
    return <span key={index}>{chunk}</span>
  })
}

/**
 * Walks the markdown and returns the heading id for the Nth heading, deduplicated.
 * Repeated headings ("Flow", "Architecture") must not share an id or
 * document.getElementById would always resolve to the first one — which broke
 * scroll-spy and anchor links. Exported so the outline derives identical ids.
 */
export function headingIds(md) {
  const ids = []
  const seen = new Map()
  let inFence = false
  for (const line of String(md || '').split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const base = slugifyHeading(m[2]) || 'section'
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    ids.push({ level: m[1].length, raw: m[2], id: n === 1 ? base : `${base}-${n}` })
  }
  return ids
}

// GitHub-style heading id so in-page [links](#anchor) actually jump.
// Exported so the on-this-page outline derives identical ids.
export function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link text only
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

const HEADING_STYLES = {
  1: 'text-2xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-4 scroll-mt-4',
  2: 'text-xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3 scroll-mt-4',
  3: 'text-lg font-semibold text-slate-900 dark:text-slate-100 mt-4 mb-2 scroll-mt-4',
  4: 'text-base font-semibold text-slate-900 dark:text-slate-100 mt-4 mb-2 scroll-mt-4',
  5: 'text-sm font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1 scroll-mt-4',
  6: 'text-sm font-semibold text-slate-600 dark:text-slate-400 mt-3 mb-1 scroll-mt-4',
}

/**
 * Markdown renderer with support for:
 * - Headers (h1-h6) with anchor ids
 * - Code blocks with language (mermaid/text rendered plain)
 * - Inline code, bold/italic/strikethrough, links, images
 * - Ordered and unordered lists, including nesting
 * - Tables (with alignment separators)
 * - Blockquotes (multi-line, inline formatted)
 * - Horizontal rules
 */
export default function Markdown({ text, animateMermaid = false }) {
  const [lightbox, setLightbox] = useState(null)   // { src, alt } while an image is open
  const normalized = String(text || '').replace(/```[ \t]+text[ \t]*(\r?\n|$)/g, '```text$1')
  const parts = normalized.split(/```[ \t]*([^\s`\r\n]+)?[ \t]*\r?\n([\s\S]*?)```/g)

  // Precomputed deduplicated ids, consumed in document order as headings render.
  const ids = headingIds(normalized)
  let headingCursor = 0

  return (
    <div className="markdown prose prose-slate dark:prose-invert max-w-none">
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
      {parts.map((part, index) => {
        if (index % 3 === 2) {
          const lang = (parts[index - 1] || '').toLowerCase()
          const body = part.replace(/\r?\n$/, '')

          // Mermaid blocks render as real diagrams (lazy-loaded).
          if (lang === 'mermaid') return <Mermaid key={index} code={body.trim()} animated={animateMermaid} />

          const plain = PLAIN_LANGS.has(lang)
          return (
            <div key={index} className="my-4 mx-0">
              {lang && (
                <div className="px-3 sm:px-4 py-1 text-[11px] font-mono uppercase tracking-wide text-slate-400 bg-slate-800 border border-b-0 border-slate-700/50 rounded-t-lg sm:rounded-t-lg">
                  {lang}
                </div>
              )}
              <pre className={`bg-slate-900 selection:bg-blue-500/40 selection:text-slate-100 ${lang ? 'rounded-b-lg' : 'rounded-lg'} p-3 sm:p-4 text-[12px] sm:text-sm overflow-x-auto max-w-full border border-slate-700/50`}>
                <code className={`text-slate-100 leading-relaxed font-mono ${lang ? 'whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal' : 'whitespace-pre'}`}>
                  {plain ? body : highlightCode(body.trim())}
                </code>
              </pre>
            </div>
          )
        }
        if (index % 3 === 1) return null

        const lines = part.split('\n')
        const out = []
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex]
          const key = `${index}-${lineIndex}`

          // Standalone image line: ![alt](src "optional title")
          const imgMatch = line.match(/^\s*!\[([^\]]*)\]\(([^)"\s]+)(?:\s+"([^"]*)")?\)\s*$/)
          if (imgMatch) {
            const [, alt, src, title] = imgMatch
            out.push(
              <div key={key} className="my-4">
                <button
                  type="button"
                  onClick={() => setLightbox({ src, alt })}
                  title="Click to enlarge"
                  className="block w-full cursor-zoom-in group"
                >
                  <img
                    src={src}
                    alt={alt}
                    title={title}
                    className="max-w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700 transition-shadow group-hover:shadow-lg"
                    loading="lazy"
                  />
                </button>
                {alt && <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">{alt}</p>}
              </div>
            )
            continue
          }

          // Group consecutive pipe lines into one table (skip the |---| separator).
          // Like GFM, a table only starts when a |---| line follows the header, so
          // pipes in prose or inline code (`{ |li| ... }`) don't become a table.
          const isRow = (l) => l && l.includes('|') && l.split('|').map(c => c.trim()).filter(Boolean).length > 1
          const isSep = (l) => l && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-')
          if (isRow(line) && !isSep(line) && isSep(lines[lineIndex + 1])) {
            const rows = []
            let align = []
            let j = lineIndex
            while (j < lines.length && (isRow(lines[j]) || isSep(lines[j]))) {
              if (isSep(lines[j])) {
                // Capture per-column alignment from :--- / :---: / ---:
                align = lines[j].split('|').map(c => c.trim()).filter((c, i, a) => !(c === '' && (i === 0 || i === a.length - 1)))
                  .map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'))
              } else {
                rows.push(lines[j].split('|').map(c => c.trim()).filter((c, i, a) => !(c === '' && (i === 0 || i === a.length - 1))))
              }
              j++
            }
            const [head, ...body] = rows
            if (head) {
              out.push(
                <div key={key} className="overflow-x-auto my-4 -mx-4 sm:mx-0 rounded-lg border border-slate-200 dark:border-slate-700 max-w-full">
                  <table className="min-w-full text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        {head.map((cell, ci) => (
                          <th key={ci} style={{ textAlign: align[ci] || 'left' }} className="px-3 sm:px-4 py-2 sm:py-2.5 font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700">{formatInline(cell)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {body.map((cells, ri) => (
                        <tr key={ri} className="even:bg-slate-50 dark:even:bg-slate-800/40">
                          {cells.map((cell, ci) => (
                            <td key={ci} style={{ textAlign: align[ci] || 'left' }} className="px-3 sm:px-4 py-2 sm:py-2.5 align-top text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">{formatInline(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              lineIndex = j - 1
              continue
            }
          }

          // Horizontal rule: --- *** ___ (must come before list/paragraph handling)
          if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
            out.push(<hr key={key} className="my-6 border-slate-200 dark:border-slate-700" />)
            continue
          }

          // Blockquote: group consecutive "> " lines into one block
          if (/^\s*>\s?/.test(line)) {
            const quoted = []
            let j = lineIndex
            while (j < lines.length && /^\s*>\s?/.test(lines[j])) {
              quoted.push(lines[j].replace(/^\s*>\s?/, ''))
              j++
            }
            out.push(
              <blockquote key={key} className="border-l-4 border-blue-500 pl-4 py-1 my-3 text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-900/10 rounded-r">
                {quoted.map((q, qi) => (
                  q.trim()
                    ? <p key={qi} className="my-1 leading-relaxed">{formatInline(q)}</p>
                    : <br key={qi} />
                ))}
              </blockquote>
            )
            lineIndex = j - 1
            continue
          }

          // Lists: group consecutive items into a real <ul>/<ol>, supporting nesting
          const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
          if (listMatch) {
            const ordered = /\d+\./.test(listMatch[2])
            const items = []
            let j = lineIndex
            while (j < lines.length) {
              const m = lines[j].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
              if (!m) {
                // A blank line followed by another item keeps the same list going
                if (lines[j].trim() === '' && lines[j + 1] && /^(\s*)([-*+]|\d+\.)\s+/.test(lines[j + 1])) { j++; continue }
                break
              }
              if (/\d+\./.test(m[2]) !== ordered) break   // switching list type ends this list
              items.push({ indent: Math.floor(m[1].length / 2), content: m[3] })
              j++
            }
            const ListTag = ordered ? 'ol' : 'ul'
            const start = ordered ? parseInt(listMatch[2], 10) || 1 : undefined
            out.push(
              <ListTag
                key={key}
                start={start}
                className={`my-2 ml-6 space-y-1 ${ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {items.map((it, ii) => (
                  <li
                    key={ii}
                    style={it.indent ? { marginLeft: `${it.indent * 1.25}rem` } : undefined}
                    className="text-slate-700 dark:text-slate-300 leading-relaxed"
                  >
                    {formatInline(it.content)}
                  </li>
                ))}
              </ListTag>
            )
            lineIndex = j - 1
            continue
          }

          if (line.trim() === '```') continue // orphan/empty code fence from source data
          // A blank line separates blocks in Markdown; it is not a line break.
          // Block margins already provide the spacing, so emitting <br> here
          // stacked extra gaps around code blocks, tables and diagrams.
          if (!line.trim()) continue

          // Headings h1-h6, with an id so in-page anchor links work
          const h = line.match(/^(#{1,6})\s+(.*)$/)
          if (h) {
            const level = h[1].length
            const content = h[2]
            const Tag = `h${level}`
            const id = ids[headingCursor]?.id || slugifyHeading(content)
            headingCursor++
            out.push(
              <Tag key={key} id={id} className={HEADING_STYLES[level]}>
                {formatInline(content)}
              </Tag>
            )
            continue
          }

          out.push(<p key={key} className="text-slate-700 dark:text-slate-300 leading-relaxed my-2">{formatInline(line)}</p>)
        }
        return out
      })}
    </div>
  )
}
