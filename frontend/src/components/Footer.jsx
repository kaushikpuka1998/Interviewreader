
// Slim footer with the legal links, shown under the reader and on the terms page.
export default function Footer() {
  return (
    <footer className="sticky bottom-0 z-20 flex-shrink-0 border-t border-slate-200 bg-white px-4 py-1.5 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      <span>© {new Date().getFullYear()} Interview Reader</span>
      <span className="mx-2" aria-hidden="true">·</span>
      <a href="/feedback" className="font-medium hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">Feedback</a>
      <span className="mx-2" aria-hidden="true">·</span>
      <a href="/terms" className="font-medium hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">Terms &amp; Conditions</a>
    </footer>
  )
}
