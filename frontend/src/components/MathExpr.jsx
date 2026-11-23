import { useEffect, useState } from 'react'

// LaTeX in answers: \[ ... \] or $$ ... $$ as a centred block, \( ... \) inline. KaTeX loads on first use so pages
// without formulas don't pay for it. If it fails to load or parse, the formula is shown as plain text.
export default function MathExpr({ tex, block = false }) {
  const [html, setHtml] = useState(null)
  useEffect(() => {
    let live = true
    Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([k]) => { if (live) setHtml(k.default.renderToString(tex, { displayMode: block, throwOnError: false, output: 'html' })) })
      .catch(() => {})
    return () => { live = false }
  }, [tex, block])
  if (html == null) return block ? <pre className="my-3 overflow-x-auto text-sm text-slate-600 dark:text-slate-300">{tex}</pre> : <code>{tex}</code>
  return block
    ? <div className="my-4 overflow-x-auto text-center" role="math" dangerouslySetInnerHTML={{ __html: html }} />
    : <span role="math" dangerouslySetInnerHTML={{ __html: html }} />
}
