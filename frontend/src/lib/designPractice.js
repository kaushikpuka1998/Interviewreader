// Solo system design practice: design questions, scored attempts (coverage out of 10), history and the attempt allowance.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}/practice/design${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.')
    err.status = res.status
    err.quota = data.quota   // 402: out of attempts, with the plans to offer
    err.simulationQuota = data.simulationQuota
    throw err
  }
  return data
}

export const fetchDesignQuestions = () => call('/questions')
export const fetchDesignQuestion = id => call(`/questions/${encodeURIComponent(id)}`)
export const submitDesignAttempt = (id, answer, mode, durationSec, difficulty, signals) => call(`/questions/${encodeURIComponent(id)}/attempts`, 'POST', { answer, mode, durationSec, difficulty, signals })
export const probeDesignAnswer = (id, answer) => call(`/questions/${encodeURIComponent(id)}/probe`, 'POST', { answer })
export const simulateArchitecture = (id, nodes, edges, targetRps, referenceTemplate = false) => call(`/questions/${encodeURIComponent(id)}/simulate`, 'POST', { nodes, edges, targetRps, referenceTemplate })
export const fetchLatestSimulation = id => call(`/questions/${encodeURIComponent(id)}/simulation/latest`)
export const fetchDesignAttempts = () => call('/attempts')
export const fetchDesignAttempt = id => call(`/attempts/${id}`)
export const fetchPracticeQuota = () => call('/quota')

// Admin: review and edit rubrics, and score a sample answer against one.
async function admin(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}/admin/design-rubrics${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}
export const searchRubrics = q => admin(`?q=${encodeURIComponent(q)}`)
export const fetchRubric = id => admin(`/${encodeURIComponent(id)}`)
export const saveRubric = (id, rubric) => admin(`/${encodeURIComponent(id)}`, 'PUT', rubric)
export const resetRubric = id => admin(`/${encodeURIComponent(id)}`, 'DELETE')
export const testRubric = (id, answer) => admin(`/${encodeURIComponent(id)}/test`, 'POST', { answer })
// Private content kept out of the public repo: interview banks and hand-written rubrics, imported from JSON files.
export const importInterviewBanks = data => admin('/import/banks', 'POST', data)
export const importRubrics = (data, overwrite) => admin(`/import/rubrics?overwrite=${overwrite ? 'true' : 'false'}`, 'POST', data)

