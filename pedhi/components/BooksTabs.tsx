'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  ['/books', 'Overview'], ['/books/daybook', 'Day Book'], ['/books/ledgers', 'Ledgers'], ['/books/reports', 'P&L · Balance Sheet'],
  ['/books/gst', 'GST'], ['/books/bank', 'Bank reco'], ['/books/journal', 'Advanced entry'], ['/books/ca', 'CA pack'],
]
export function BooksTabs() {
  const path = usePathname()
  if (path.startsWith('/books/new')) return null
  return (
    <nav aria-label="Books" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1 print:hidden">
      {TABS.map(([h, l]) => {
        const on = h === '/books' ? path === h : path.startsWith(h)
        return <Link key={h} href={h} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] font-medium transition ${on ? 'border-bahi text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{l}</Link>
      })}
    </nav>
  )
}
