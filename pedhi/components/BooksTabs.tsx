'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const TABS = [
  ['/books', 'Overview'], ['/books/daybook', 'Day Book'], ['/books/ledgers', 'Ledgers'], ['/books/reports', 'P&L · Balance Sheet'],
  ['/books/gst', 'GST'], ['/books/bank', 'Bank reco'], ['/books/journal', 'Advanced entry'], ['/books/ca', 'CA pack'],
]
export function BooksTabs() {
  const path = usePathname()
  const nav = useRef<HTMLElement>(null)
  // on a phone most tabs sit off-screen: bring the open one into view
  useEffect(() => { nav.current?.querySelector('[aria-current]')?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [path])
  if (path.startsWith('/books/new')) return null
  return (
    <nav ref={nav} aria-label="Books" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden">
      {TABS.map(([h, l]) => {
        const on = h === '/books' ? path === h : path.startsWith(h)
        return <Link key={h} href={h} aria-current={on ? 'page' : undefined} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] font-medium transition ${on ? 'border-bahi text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{l}</Link>
      })}
    </nav>
  )
}
