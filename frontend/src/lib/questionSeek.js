/**
 * Load a question page, then keep loading the following pages until `id` is in the list (at most `maxExtra` more).
 * A refresh or shared link opens a question that can sit on a later page; with the pages up to it loaded the list starts at the top
 * and Previous and Next walk the question's real neighbours. Returns the last page's data with `content` holding everything loaded.
 */
export async function loadUntil(fetchPage, page, id, maxExtra = 12) {
  let data = await fetchPage(page)
  if (!id || data.content.some(q => q.id === id)) return data
  const content = [...data.content]
  for (let n = 0; n < maxExtra && data.totalPages > data.number + 1 && !content.some(q => q.id === id); n++) {
    data = await fetchPage(data.number + 1)
    content.push(...data.content)
  }
  return { ...data, content }
}
