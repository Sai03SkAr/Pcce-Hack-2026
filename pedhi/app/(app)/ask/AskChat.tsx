'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowUp, Database, Sparkles } from 'lucide-react'
import { ask } from '@/app/actions'
import { Mic } from '@/components/Mic'
import type { Evidence } from '@/lib/chat'

type Msg = { role: 'user' | 'ai'; text: string; evidence?: Evidence[]; source?: string; error?: boolean }
const TOOL: Record<string, string> = {
  sales_summary: 'Sales summary', sales_by_day: 'Sales by day', branch_comparison: 'Branch comparison', top_items: 'Top items',
  stock_status: 'Stock status', receivables: 'Udhaar ledger', customer_profile: 'Customer ledger', business_alerts: 'Insight engine',
}

function EvidenceView({ ev }: { ev: Evidence[] }) {
  return (
    <details className="mt-2 text-[12.5px]">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-muted hover:text-ink"><Database className="size-3.5" />How this was calculated · {ev.length} {ev.length === 1 ? 'query' : 'queries'}</summary>
      <div className="mt-2 space-y-2">{ev.map((e, i) => (
        <div key={i} className="rounded-[10px] border border-line bg-paper-2/60 p-2.5">
          <div className="font-semibold">{TOOL[e.tool] ?? e.tool} <span className="font-normal text-muted">{Object.entries(e.input).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join(' · ')}</span></div>
          <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-2">{JSON.stringify(e.result, null, 1).slice(0, 2500)}</pre>
        </div>))}</div>
    </details>
  )
}

export function AskChat({ name, suggestions, ai, lang }: { name: string; suggestions: string[]; ai: boolean; lang: 'en' | 'hi' }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [pending, start] = useTransition()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, pending])

  const send = (text: string) => {
    if (!text.trim() || pending) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text }])
    start(async () => {
      const r = await ask(text)
      setMsgs((m) => [...m, r.ok ? { role: 'ai', text: r.data.text, evidence: r.data.evidence, source: r.data.source } : { role: 'ai', text: r.error, error: true }])
    })
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-3xl flex-col">
      {!msgs.length && (
        <div className="flex flex-1 flex-col justify-center py-8 rise">
          <span className="grid size-12 place-items-center rounded-[14px] bg-bahi text-[#fff6e6]"><Sparkles className="size-6" /></span>
          <h1 className="display mt-4 text-[34px] font-semibold leading-tight">{lang === 'hi' ? `Poochhiye, ${name} ji.` : `Ask your business, ${name}.`}</h1>
          <p className="mt-2 max-w-lg text-[15px] text-ink-2">Hindi, English or Hinglish, typed or spoken. Every number comes from your books, and you can open the query behind it.</p>
          <div className="mt-6 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => send(s)} className="btn rounded-full text-[13.5px] font-medium">{s}</button>)}</div>
          {!ai && <p className="mt-6 text-[12.5px] text-muted">No AI key is set, so answers come from the built-in rule engine. Add ANTHROPIC_API_KEY for free-form questions.</p>}
        </div>
      )}
      <div className="flex-1 space-y-4 py-4">
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-[16px] rounded-br-sm bg-ink px-4 py-2.5 text-[14.5px] text-paper">{m.text}</p></div>
        ) : (
          <div key={i} className="flex gap-3 rise">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-bahi text-[12px] font-semibold text-[#fff6e6]">पे</span>
            <div className="min-w-0 flex-1">
              <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${m.error ? 'text-bahi' : ''}`}>{m.text}</p>
              {m.evidence && m.evidence.length > 0 && <EvidenceView ev={m.evidence} />}
            </div>
          </div>
        ))}
        {pending && <div className="flex gap-3"><span className="grid size-8 place-items-center rounded-full bg-bahi text-[12px] font-semibold text-[#fff6e6]">पे</span><span className="typing flex items-center gap-1 pt-2">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 rounded-full bg-muted" />)}</span></div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="sticky bottom-20 lg:bottom-4">
        <div className="card flex items-center gap-2 p-2 shadow-[var(--shadow-lg)]">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="h-10 flex-1 bg-transparent px-2 text-[15px] outline-none" placeholder={lang === 'hi' ? 'Is hafte Mapusa ki sale kam kyun hai?' : 'Why are Mapusa sales down this week?'} aria-label="Your question" />
          <Mic onText={send} lang={lang === 'hi' ? 'hi-IN' : 'en-IN'} className="size-10 rounded-full p-0" />
          <button className="btn btn-primary size-10 rounded-full p-0" disabled={pending || !input.trim()} aria-label="Ask"><ArrowUp className="size-5" /></button>
        </div>
      </form>
    </div>
  )
}
