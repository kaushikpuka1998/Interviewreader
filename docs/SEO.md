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

## Brand name (the "interviewreader" search)

Searching `interviewreader` can show another site (InterviewReady, interviewready.io) because Google treats the query as a
misspelling of that larger brand. Markup cannot override that, but it removes every inconsistency on our side:

- The brand is written **InterviewReader** (one word: the domain and the logo) in the `<title>`, `og:site_name`, the
  `WebSite` and `Organization` JSON-LD (`index.html`, `lib/seo.js`) and the crawler HTML (`BotPageController`).
  `Interview Reader`, `Interview Reader Cloud` and `interviewreader.cloud` are declared as `alternateName`.
- Filtered home URLs (`/?tech=`, `?q=`), the feedback page and private pages are `noindex`, so the home page is the one
  page that carries the brand.

Off-site steps that actually move this (do these in order):

1. Google Search Console: request indexing for `https://interviewreader.cloud/`, then check Performance for the query `interviewreader`.
2. Searching by the exact spelling, then clicking our result ("Search instead for interviewreader"), teaches Google the spelling is a real brand.
3. Add `sameAs` to the Organization JSON-LD once these exist: LinkedIn company page, GitHub repo or org, X, Product Hunt, Reddit/Hashnode posts, all using the name "InterviewReader" and linking to `interviewreader.cloud`.
4. Bing Webmaster Tools + IndexNow (ChatGPT search and Copilot use Bing's index); keep `robots.txt` and `llms.txt` as they are.
5. Backlinks that use the anchor text "InterviewReader" (directories, dev.to / Medium posts, college and community groups).

## Search Console coverage (report of 2026-11-25)

6,087 pages not indexed against 1,479 indexed (the sitemap listed about 7,550 URLs). Critical issues in the report:

| Reason | Pages | Cause |
|---|---|---|
| Discovered - currently not indexed | 5,547 | Google found the URLs but has not crawled them. Most are members-only questions, which show a signed-out visitor only the question (no answer): thin pages that lower Google's trust in the whole site. |
| Alternate page with proper canonical tag | 461 | Filtered or duplicate URLs pointing at the real page. Expected, not an error. |
| Page with redirect | 53 | Old hosts and trailing-slash variants. Expected. |
| Crawled - currently not indexed | 23 | Thin or near-duplicate pages. |
| Duplicate, Google chose a different canonical | 3 | The crawler HTML used `/slug?id=...` as canonical while the sitemap and the app use `/slug`. |

What changed:

- The sitemap (`scripts/gen-sitemap.mjs`) lists only questions a signed-out visitor can read (`open` flag on `/api/questions/index`).
  After a deploy, run `npm run sitemap` against the live API and ship the new `sitemap.xml`, then resubmit it in Search Console.
- Members-only question pages are `noindex, follow` (`lib/seo.js` in the app, and the crawler HTML in `BotPageController`).
  When they show a real preview (see below) remove that rule.
- The crawler HTML canonical is the plain slug URL, matching the sitemap; `?id=` stays only when two questions share a slug.

Next step with the biggest effect: show every signed-out visitor (and Google) a preview of each members-only answer, for example its
outline and first section, with the paywall markup `isAccessibleForFree: false`. The preview must be the same for users and crawlers.
That turns thousands of empty pages into indexable ones and also raises sign-ups. It is a product decision, so it is not done here.
