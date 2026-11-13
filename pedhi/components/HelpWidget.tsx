'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowUp, BookOpen, LifeBuoy, X } from 'lucide-react'
import { helpAsk } from '@/app/actions'
import { HELP_SUGGESTIONS } from '@/lib/help-suggestions'
import { Mic } from './Mic'

type Msg = { q: string; a?: string; sources?: { title: string; href: string }[]; source?: string }

/** The guide: answers "how do I…" from Pedhi's own help articles, with links to the right screen. */
export function HelpWidget() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [pending, start] = useTransition()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, pending])
  const base = '/' + (path.split('/')[1] ?? '')
  const suggestions = HELP_SUGGESTIONS[base] ?? HELP_SUGGESTIONS.default

  const ask = (q: string) => {
    if (!q.trim() || pending) return
    setInput('')
    setMsgs((m) => [...m, { q }])
    start(async () => {
      const r = await helpAsk(q, path)
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, a: r?.text ?? '', sources: r?.sources, source: r?.source } : x)))
    })
  }

  if (path.startsWith('/ask') || path.startsWith('/whatsapp')) return null // these screens are chats already; the button would cover Send
  const lift = path.startsWith('/bill') ? 'bottom-[140px]' : 'bottom-20' // stay clear of the bill's cart bar on phones
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Help"
        className={`fixed ${lift} right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-paper shadow-[var(--shadow-lg)] transition hover:scale-[1.03] lg:bottom-6 lg:right-6 print:hidden`}>
        {open ? <X className="size-5" /> : <LifeBuoy className="size-5" />}<span className="hidden sm:inline">{open ? 'Close' : 'Help'}</span>
      </button>
      {open && (
        <section role="dialog" aria-label="Pedhi guide" className="card rise fixed inset-x-3 bottom-36 z-40 flex max-h-[70dvh] flex-col overflow-hidden shadow-[var(--shadow-lg)] sm:inset-x-auto sm:right-6 sm:w-[400px] lg:bottom-24 print:hidden">
          <header className="flex items-center gap-2.5 border-b border-line bg-paper-2/60 px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-gold-soft text-gold"><BookOpen className="size-4" /></span>
            <div className="leading-tight"><div className="text-[14px] font-semibold">Pedhi guide</div><div className="text-[12px] text-muted">How to do anything in the app. Hindi or English.</div></div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!msgs.length && (
              <div>
                <p className="text-[13.5px] text-ink-2">Ask how to do something, like “How do I record rent?” or “Cash bank mein jama kaise karu?”</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-2 px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-gold">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-[14px] rounded-br-sm bg-ink px-3 py-2 text-[13.5px] text-paper">{m.q}</p>
                {m.a !== undefined && (
                  <div className="rounded-[14px] rounded-tl-sm bg-paper-2 px-3 py-2.5 text-[13.5px] leading-relaxed">
                    <p className="whitespace-pre-wrap">{m.a}</p>
                    {!!m.sources?.length && <div className="mt-2 flex flex-wrap gap-1.5">{m.sources.map((s) => (
                      <Link key={s.title} href={s.href} onClick={() => setOpen(false)} className="chip chip-gold h-6">{s.title} →</Link>))}</div>}
                  </div>
                )}
              </div>
            ))}
            {pending && <div className="typing flex w-fit gap-1 rounded-[14px] bg-paper-2 px-3 py-3">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 rounded-full bg-muted" />)}</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex items-center gap-1.5 border-t border-line p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="h-10 flex-1 bg-transparent px-2 text-[14px] outline-none" placeholder="How do I…" aria-label="Your question" />
            <Mic onText={ask} lang="hi-IN" className="size-9 rounded-full border-0 p-0" />
            <button className="btn btn-primary size-9 rounded-full p-0" disabled={pending || !input.trim()} aria-label="Ask"><ArrowUp className="size-4" /></button>
          </form>
        </section>
      )}
    </>
  )
}
