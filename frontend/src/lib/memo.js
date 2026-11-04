// Share one request between callers that ask at the same moment, and optionally reuse the answer for a short time.
// Failed requests are never kept. ttlMs = 0 means "only while the request is in flight".
const store = new Map()
export function shared(key, ttlMs, load) {
  const hit = store.get(key)
  if (hit && (hit.pending || Date.now() - hit.at < ttlMs)) return hit.promise
  const entry = { at: Date.now(), pending: true }
  entry.promise = load().then(
    v => { entry.pending = false; entry.at = Date.now(); if (!ttlMs) store.delete(key); return v },
    e => { store.delete(key); throw e })
  store.set(key, entry)
  return entry.promise
}
