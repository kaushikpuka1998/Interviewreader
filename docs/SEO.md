# SEO setup

## What is implemented

| Item | Where | Status |
|---|---|---|
| Per-question `<title>` and description | `frontend/src/lib/seo.js` | done |
| Canonical URLs | `seo.js` | done |
| Open Graph + Twitter cards | `seo.js` + `index.html` | done |
| `QAPage` JSON-LD (rich results) | `seo.js` | done |
| `BreadcrumbList` JSON-LD | `seo.js` | done |
| Paywall markup for gated topics | `seo.js` | done |
| `sitemap.xml` | `scripts/gen-sitemap.mjs` | done |
| `robots.txt` | `scripts/gen-sitemap.mjs` | done |

## Regenerating the sitemap

Run after publishing questions or problems, before deploying the frontend:

```bash
npm run sitemap
```

It reads the production API (`https://api.interviewreader.cloud/api`; override with `API_BASE`, and the site
with `SITE_URL`). No token is needed: `GET /questions/index` lists every question, gated topics included, without
answers. The sitemap covers questions, every coding problem (`/practice?id=`), company problem lists
(`/problems?company=`), company types (`/problems?group=&sub=`), company roadmaps and the public pages.

If the backend doesn't have `/questions/index` yet, the script falls back to the paged list, which only sees the
free topics. Deploy the backend first. Note `interviewreader.cloud/api` is the frontend and returns HTML; the script
stops with a clear message if `API_BASE` points there.

## Remaining steps (not code)

1. **Google Search Console** — verify the domain, submit `https://<site>/sitemap.xml`.
2. **Bing Webmaster Tools** — same, it also feeds DuckDuckGo.
3. **Add an OG image** (1200x630) at `frontend/public/og.png`, then set
   `og:image` in `index.html`. Links currently share without a preview image.
4. **Rich Results Test** — paste a question URL into
   <https://search.google.com/test/rich-results> to confirm the QAPage markup is valid.

## The big limitation: client-side rendering

This is a SPA, so the HTML Google first downloads is an empty `<div id="root">`.
Googlebot does execute JavaScript and will see the content on a second pass, but
that pass is queued and can take days to weeks. Other crawlers (many social
scrapers, Bing historically) are less reliable at it.

The fix is to serve pre-rendered HTML for question URLs. Options, cheapest first:

1. **Prerender at build time** — generate a static HTML file per question with the
   title/description/JSON-LD baked in. Works well because the content changes rarely.
2. **A prerender service** (prerender.io, Cloudflare) that serves cached HTML to bots.
3. **Move to Next.js / Remix** with SSR — the proper fix, the largest change.

Until one of these is in place, expect indexing to be slow.

## The gating trade-off

Topics outside `FREE_TECHS` return `401` to signed-out callers, including Googlebot.
The `isAccessibleForFree: false` markup is Google's sanctioned way to declare this
(flexible sampling), so it is not treated as cloaking — but **restricted pages rank
worse than open ones**, because Google cannot see the full answer.

Currently free: `microservices`, `design-patterns` (138 of 3,069 questions ≈ 4.5%).

If organic traffic matters more than sign-ups, widen `FREE_TECHS`. A common
compromise is to open the highest-volume topics (Java, React) and gate the rest.
Watch the referrer panel in the admin analytics to see which way the trade lands.
