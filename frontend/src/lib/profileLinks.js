// Client-side twins of the server's GitHub / LinkedIn rules (PublicDetails.java), so a wrong link is caught while typing.
// A bare name is taken as is; a link must be on github.com / linkedin.com itself. The server checks again.
const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/
const LINKEDIN_NAME = /^[A-Za-z0-9_%-]{3,100}$/
const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/?(?:[?#].*)?$/i
const LINKEDIN_URL = /^(?:https?:\/\/)?(?:www\.|[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})\/?(?:[?#].*)?$/i

function parse(raw, url, name, ok, hint) {
  let t = String(raw || '').trim()
  if (!t) return { ok: true, value: '' }
  if (t.startsWith('@')) t = t.slice(1)
  if (/[/.:]/.test(t)) {
    const m = t.match(url)
    return m ? { ok: true, value: m[1] } : { ok: false, error: hint }
  }
  return name.test(t) && !t.endsWith('-') ? { ok: true, value: t } : { ok: false, error: ok }
}

export const parseGithub = raw => parse(raw, GITHUB_URL, GITHUB_NAME, "That doesn't look like a GitHub username.", 'Use your GitHub username, or a link like github.com/your-name.')
export const parseLinkedin = raw => parse(raw, LINKEDIN_URL, LINKEDIN_NAME, "That doesn't look like a LinkedIn profile name.", 'Use your LinkedIn profile name, or a link like linkedin.com/in/your-name.')
