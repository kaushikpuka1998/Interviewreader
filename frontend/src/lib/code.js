const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8082/api'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Sends a run to the server queue and returns its job id. Throws with the server's message if it's refused.
async function submit(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not run the code.')
  return data.jobId
}

// Polls a queued job until it finishes. onStatus receives "Waiting in line…" or "Running…".
async function waitFor(jobId, onStatus) {
  const started = Date.now()
  // Check quickly at first, then less often, so a slow run doesn't flood the server with requests.
  let wait = 400
  while (true) {
    await sleep(wait)
    wait = Math.min(Math.round(wait * 1.5), 2000)
    const res = await fetch(`${API_BASE}/code/jobs/${jobId}`)
    if (!res.ok) throw new Error('Lost track of this run. Try again.')
    const job = await res.json()
    if (job.state === 'DONE') {
      if (job.httpStatus >= 400) throw new Error(job.body?.error || 'Could not run the code.')
      return job.body
    }
    onStatus?.(job.state === 'QUEUED' ? `Waiting in line (position ${job.position})…` : 'Running…')
    if (Date.now() - started > 150_000) throw new Error('This is taking too long. Try again.')
  }
}

// Runs a snippet through the queue. Returns { status, stdout, stderr, compileOutput, time, memoryKb }.
export async function runCode({ language, code, stdin, problemId = null, onStatus }) {
  const jobId = await submit('/code/run', { language, code, stdin, problemId })
  return waitFor(jobId, onStatus)
}

// Runs the code against a coding problem's test cases. Returns { passed, total, results: [{ number, passed, status }] }.
export async function runTests({ problemId, language, code, submit: saveIt = false, onStatus }) {
  const jobId = await submit('/code/test', { problemId, language, code, submit: saveIt })
  return waitFor(jobId, onStatus)
}

// The member's saved submissions for one problem, newest first.
export async function fetchSubmissions(problemId) {
  const res = await fetch(`${API_BASE}/code/submissions?problemId=${problemId}`)
  return res.ok ? res.json() : []
}

// One saved submission: its code, verdict, and per-test results.
export async function fetchSubmission(id) {
  const res = await fetch(`${API_BASE}/code/submissions/${id}`)
  if (!res.ok) throw new Error('Could not open this submission.')
  return res.json()
}

// The member's submission times over the last year (ISO strings), for the activity heatmap.
export async function fetchActivity() {
  const res = await fetch(`${API_BASE}/code/activity`)
  return res.ok ? res.json() : { times: [] }
}

// Ids of every problem the member has submitted to (solved or not).
export async function fetchAttemptedIds() {
  const res = await fetch(`${API_BASE}/code/attempted`)
  return res.ok ? res.json() : []
}

// Ids of the problems the member has solved.
export async function fetchSolvedIds() {
  const res = await fetch(`${API_BASE}/code/solved`)
  return res.ok ? res.json() : []
}
