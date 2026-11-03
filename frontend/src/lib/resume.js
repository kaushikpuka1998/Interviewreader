const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function json(res, fallback) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || fallback)
  }
  return res.json()
}

export const fetchTemplates = () =>
  fetch(`${API_BASE}/resume-templates`).then(r => json(r, 'Could not load templates'))

export const fetchResumes = () =>
  fetch(`${API_BASE}/resumes`).then(r => json(r, 'Could not load your resumes'))

export const fetchResume = (id) =>
  fetch(`${API_BASE}/resumes/${id}`).then(r => json(r, 'Could not load this resume'))

export const createResume = (payload) =>
  fetch(`${API_BASE}/resumes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(r => json(r, 'Could not create the resume'))

export const saveResume = (id, payload) =>
  fetch(`${API_BASE}/resumes/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(r => json(r, 'Could not save the resume'))

export const deleteResume = async (id) => {
  const res = await fetch(`${API_BASE}/resumes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not delete the resume')
}

export const previewLatex = (payload) =>
  fetch(`${API_BASE}/resumes/preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(r => json(r, 'Preview failed')).then(d => d.latex)

// Downloads the .tex file. The token travels in a header, so this goes through fetch, not a plain link.
export async function downloadLatex(id, fallbackName) {
  const res = await fetch(`${API_BASE}/resumes/${id}/latex`)
  if (!res.ok) throw new Error('Could not download the LaTeX file')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fallbackName || 'resume'}.tex`
  a.click()
  URL.revokeObjectURL(url)
}

export const fetchLatexText = (id) =>
  fetch(`${API_BASE}/resumes/${id}/latex/text`).then(r => json(r, 'Could not load the LaTeX'))

export const saveLatexText = (id, latex) =>
  fetch(`${API_BASE}/resumes/${id}/latex`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex }),
  }).then(r => json(r, 'Could not save the LaTeX'))

export const resetLatexText = (id) =>
  fetch(`${API_BASE}/resumes/${id}/latex`, { method: 'DELETE' }).then(r => json(r, 'Could not reset the LaTeX'))

// Compiles the LaTeX on the server and downloads the PDF. Compile errors throw with the LaTeX log.
export async function compileLatexPdf(id, fallbackName) {
  const res = await fetch(`${API_BASE}/resumes/${id}/compile`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || 'Compile failed')
    err.log = body.log || ''
    throw err
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fallbackName || 'resume'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// Live preview: compiles the given content to a PDF, without saving. Returns the Response.
export const previewPdfRequest = (body, signal) =>
  fetch(`${API_BASE}/resumes/preview-pdf`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  })

// Live preview of LaTeX the member is editing. Returns the Response.
export const previewLatexRequest = (latex, signal) =>
  fetch(`${API_BASE}/resumes/preview-latex`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex }), signal,
  })
