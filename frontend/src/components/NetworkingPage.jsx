import { useEffect } from 'react'
import TopBar from './TopBar.jsx'
import ProtocolExplorer from './ProtocolExplorer.jsx'
import { setPageSeo } from '../lib/seo.js'

export default function NetworkingPage() {
  useEffect(() => {
    setPageSeo({ title: 'Networking Protocol Explorer | Interview Reader', description: 'Explore networking protocols with interactive packet-level animations.', path: '/networking' })
  }, [])

  return <><TopBar /><main className="min-h-screen bg-slate-100 px-3 py-6 dark:bg-slate-950 sm:px-5"><div className="mx-auto max-w-[1720px]"><header className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600 dark:text-blue-300">Networking fundamentals</p><h1 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">Interactive protocol explorer</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Follow requests, replies, retransmissions, and packet loss one hop at a time.</p></header><ProtocolExplorer /></div></main></>
}
