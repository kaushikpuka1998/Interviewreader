import { useRef } from 'react'
// A small code editor: line numbers, Tab indents by four spaces, and keyword/string/comment highlighting.
const KEYWORDS = {
  cpp: 'auto bool break case catch char class const continue default delete do double else enum explicit extern false float for friend if include inline int long namespace new nullptr private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while',
  c: 'auto break case char const continue default do double else enum extern false float for goto if include inline int long register return short signed sizeof static struct switch true typedef union unsigned void volatile while',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass print raise return True try while with yield',
  ruby: 'alias and begin break case class def do else elsif end ensure false for if in module next nil not or puts require return self super then true undef unless until when while yield',
  rust: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut println pub ref return self Self static struct super trait true type unsafe use where while',
  csharp: 'abstract as base bool break byte case catch char class const continue decimal default do double else enum false float for foreach if in int interface long namespace new null object out override private protected public readonly ref return static string struct switch this throw true try typeof using var virtual void while Console',
  php: 'abstract and array as break case catch class const continue default do echo else elseif extends false final for foreach function if implements include namespace new null or private protected public return static switch this throw true try use var while',
  swift: 'let var func class struct enum protocol if else for while return import guard switch case default true false nil self in print init',
  java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new null package private protected public return short static strictfp super switch synchronized this throw throws transient true false try void volatile while var record String System',
  javascript: 'async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield console',
  go: 'append break cap case chan close complex const continue copy default defer delete else fallthrough false float64 for func go goto if import int int64 interface len make map new nil package panic print println range recover return select string struct switch true type var fmt',
}
const HASH_COMMENTS = ['python', 'ruby', 'php']

const PAIRS = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" }
// Go belongs here because it is brace-based; note the Format button will re-indent it with spaces,
// not the tabs gofmt would use. Judge0 compiles it either way.
export const BRACE_LANGUAGES = new Set(['cpp', 'c', 'csharp', 'rust', 'php', 'swift', 'java', 'javascript', 'go'])

// Re-indents brace-based code: four spaces per open brace, and a closing brace goes back one level.
export function formatBraces(src) {
  const out = []
  let level = 0
  for (const raw of src.split('\n')) {
    const line = raw.trim()
    // Runs of blank lines collapse to one, so formatting does not leave gaps.
    if (!line) { if (out.length && out[out.length - 1] !== '') out.push(''); continue }
    const code = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/g, '')
    const opens = (code.match(/[{[(]/g) || []).length
    const closes = (code.match(/[}\])]/g) || []).length
    const leading = /^[}\])]/.test(line) ? 1 : 0
    out.push('    '.repeat(Math.max(0, level - leading)) + line)
    level = Math.max(0, level + opens - closes)
  }
  return out.join('\n')
}

// Re-indents by the code's own nesting, four spaces per level. Used for Python and Ruby, where indentation is the structure.
// ponytail: a line inside a multi-line string gets re-indented too; fine for typical code.
export function formatByIndent(src) {
  const out = []
  const stack = [0]
  for (const raw of src.split('\n')) {
    const expanded = raw.replace(/\t/g, '    ')
    const text = expanded.trim()
    if (!text) { if (out.length && out[out.length - 1] !== '') out.push(''); continue }
    const width = expanded.length - expanded.trimStart().length
    while (stack.length > 1 && width < stack[stack.length - 1]) stack.pop()
    if (width > stack[stack.length - 1]) stack.push(width)
    out.push('    '.repeat(stack.length - 1) + text)
  }
  return out.join('\n')
}

// Formats code in any supported language.
export function formatCode(src, language) {
  return BRACE_LANGUAGES.has(language) ? formatBraces(src) : formatByIndent(src)
}

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Returns highlighted HTML for the code. Every piece of text is escaped before it is returned.
function highlight(code, language) {
  const words = new Set((KEYWORDS[language] || '').split(' '))
  const hash = HASH_COMMENTS.includes(language) ? '|#[^\\n]*' : ''
  const pattern = new RegExp(`/\\*[\\s\\S]*?\\*/|//[^\\n]*${hash}|"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\\b\\d+(?:\\.\\d+)?\\b|\\b[A-Za-z_]\\w*\\b`, 'g')
  let out = ''
  let last = 0
  let m
  while ((m = pattern.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index))
    const t = m[0]
    let cls = ''
    if (t.startsWith('/*') || t.startsWith('//') || t.startsWith('#')) cls = 'text-slate-500 italic'
    else if (t[0] === '"' || t[0] === "'") cls = 'text-emerald-300'
    else if (/^\d/.test(t)) cls = 'text-amber-300'
    else if (words.has(t)) cls = 'text-sky-300'
    out += cls ? `<span class="${cls}">${escapeHtml(t)}</span>` : escapeHtml(t)
    last = m.index + t.length
  }
  return out + escapeHtml(code.slice(last)) + '\n'
}

export const FONTS = {
  consolas: { label: 'Consolas', family: "Consolas, 'Courier New', monospace" },
  monaco: { label: 'Monaco', family: "Monaco, Menlo, monospace" },
  courier: { label: 'Courier New', family: "'Courier New', Courier, monospace" },
  system: { label: 'System mono', family: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
}

const SHARED = { fontSize: 14, lineHeight: '24px', padding: '16px 20px 16px 72px', tabSize: 4, margin: 0, whiteSpace: 'pre', letterSpacing: 0 }

export default function CodeEditor({ value, onChange, language, font = 'consolas' }) {
  const fontFamily = (FONTS[font] || FONTS.consolas).family
  const area = useRef(null)
  const overlay = useRef(null)
  const gutter = useRef(null)
  const lines = value.split('\n').length

  const sync = () => {
    const t = area.current
    if (!t) return
    if (overlay.current) { overlay.current.scrollTop = t.scrollTop; overlay.current.scrollLeft = t.scrollLeft }
    if (gutter.current) gutter.current.scrollTop = t.scrollTop
  }

  // Put the text back and move the cursor (keeps the caret where the user expects it).
  const apply = (next, cursor) => {
    onChange(next)
    requestAnimationFrame(() => { if (area.current) area.current.selectionStart = area.current.selectionEnd = cursor })
  }

  const onKeyDown = e => {
    const t = e.target
    const s = t.selectionStart
    const end = t.selectionEnd
    const v = value

    if (e.key === 'Tab') {
      e.preventDefault()
      apply(v.slice(0, s) + '    ' + v.slice(end), s + 4)
      return
    }
    if (e.key === 'Enter') {
      // New line keeps the current indentation. Between { and } it opens an indented block.
      e.preventDefault()
      const lineStart = v.lastIndexOf('\n', s - 1) + 1
      const indent = v.slice(lineStart, s).match(/^\s*/)[0]
      if (v[s - 1] === '{' && v[s] === '}') {
        const inner = indent + '    '
        apply(v.slice(0, s) + '\n' + inner + '\n' + indent + v.slice(end), s + 1 + inner.length)
      } else {
        apply(v.slice(0, s) + '\n' + indent + v.slice(end), s + 1 + indent.length)
      }
      return
    }
    if (s === end && (e.key === '}' || e.key === ')' || e.key === ']' || e.key === '"' || e.key === "'") && v[s] === e.key) {
      // Typing a closing character that's already next just moves past it.
      e.preventDefault()
      apply(v, s + 1)
      return
    }
    if (s === end && PAIRS[e.key]) {
      e.preventDefault()
      apply(v.slice(0, s) + e.key + PAIRS[e.key] + v.slice(end), s + 1)
      return
    }
    if (e.key === 'Backspace' && s === end && s > 0 && PAIRS[v[s - 1]] === v[s]) {
      e.preventDefault()
      apply(v.slice(0, s - 1) + v.slice(s + 1), s - 1)
    }
  }

  return (
    <div className="relative h-auto min-h-[160px] flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-inner focus-within:ring-2 focus-within:ring-blue-500 selection:bg-blue-500/40 selection:text-slate-100">
      <div ref={gutter} aria-hidden="true" className="absolute inset-y-0 left-0 w-14 select-none overflow-hidden border-r border-slate-800 bg-slate-900/80 pt-4 text-right text-[14px] leading-[24px] text-slate-500" style={{ paddingRight: 14, fontFamily }}>
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre ref={overlay} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-slate-100 selection:bg-blue-500/40 selection:text-slate-100" style={{ ...SHARED, fontFamily }} dangerouslySetInnerHTML={{ __html: highlight(value, language) }} />
      <textarea
        ref={area}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={sync}
        onKeyDown={onKeyDown}
        spellCheck={false}
        wrap="off"
        aria-label="Code"
        className="absolute inset-0 h-full w-full resize-none bg-transparent text-transparent outline-none selection:bg-blue-500/40 selection:text-slate-100"
        style={{ ...SHARED, fontFamily, caretColor: '#f8fafc' }}
      />
    </div>
  )
}
