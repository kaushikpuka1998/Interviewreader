import { useEffect, useState } from 'react'
import { fetchQuestion } from './api.js'

// The question list leaves the answer text out to stay light; the reader asks for it when a question is opened.
// Answers already seen (or read from the offline cache) are kept for the session, and the next question is fetched quietly
// so that stepping forward feels instant.
const answers = new Map()      // id -> answer text
const inflight = new Map()     // id -> Promise

function load(id) {
  if (answers.has(id)) return Promise.resolve(answers.get(id))
  if (!inflight.has(id)) {
    inflight.set(id, fetchQuestion(id)
      .then(q => { if (q.answer) answers.set(id, q.answer); return q.answer || '' })
      .finally(() => inflight.delete(id)))
  }
  return inflight.get(id)
}

/** For non-React callers (page SEO): the question with its answer, fetched if the list row has none. Never rejects. */
export async function withAnswer(q) {
  if (!q || q.locked || q.answer) return q
  try { return { ...q, answer: await load(q.id) } } catch { return q }
}

/** Returns the question with its answer filled in; `answerLoading` is true while it is being fetched. */
export function useFullQuestion(question, nextId) {
  const id = question?.id
  const needs = !!question && !question.locked && !question.answer
  const [, tick] = useState(0)
  useEffect(() => {
    if (!needs) return
    let live = true
    load(id).then(() => live && tick(n => n + 1)).catch(() => live && tick(n => n + 1))
    return () => { live = false }
  }, [id, needs])
  // Warm up the next question once this one is in.
  useEffect(() => {
    if (!nextId || needs || answers.has(nextId)) return
    // Warming the next answer spends data; skip it on data-saver and slow connections.
    const conn = navigator.connection
    if (conn && (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || ''))) return
    const t = setTimeout(() => { load(nextId).catch(() => {}) }, 800)
    return () => clearTimeout(t)
  }, [nextId, needs])
  if (!question) return { question, answerLoading: false }
  if (!needs) return { question, answerLoading: false }
  const text = answers.get(id)
  return text ? { question: { ...question, answer: text }, answerLoading: false } : { question, answerLoading: inflight.has(id) || !answers.has(id) }
}
