'use client'
import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { regenerateBrief } from '@/app/actions'

/** Renders WhatsApp-style *bold* inline. */
export function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className="block min-h-[0.6em]">
          {line.split(/(\*[^*\n]+\*)/g).map((p, j) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <strong key={j}>{p.slice(1, -1)}</strong> : p))}
        </span>
      ))}
    </>
  )
}

export function BriefCard({ body, source, lang }: { body: string; source: string; lang: 'en' | 'hi' }) {
  const [state, setState] = useState({ body, source })
  const [pending, start] = useTransition()
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-wa-bg shadow-[var(--shadow)]">
      <div className="flex items-center gap-2.5 bg-wa px-4 py-2.5 text-white">
        <span className="grid size-8 place-items-center rounded-full bg-white/15 text-[13px] font-semibold">पे</span>
        <div className="leading-tight"><div className="text-[14px] font-semibold">Pedhi</div><div className="text-[11.5px] text-white/70">Morning brief · 7:00 am</div></div>
        <button disabled={pending} onClick={() => start(async () => { const r = await regenerateBrief(lang); if (r.ok) setState(r.data) })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[12px] hover:bg-white/20" aria-label="Write the brief again">
          <RefreshCw className={`size-3.5 ${pending ? 'animate-spin' : ''}`} />{pending ? 'Writing…' : 'Rewrite'}
        </button>
      </div>
      <div className="p-3 sm:p-4">
        <div className="relative max-w-[560px] rounded-[12px] rounded-tl-sm bg-card px-3.5 py-3 text-[14px] leading-[1.55] shadow-[var(--shadow)]">
          <WaText text={state.body} />
          <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-muted">
            <span className={`chip h-[18px] px-1.5 text-[10.5px] ${state.source === 'ai' ? 'chip-green' : 'chip-gold'}`}>{state.source === 'ai' ? 'Written by AI from verified numbers' : 'Rule engine'}</span>7:00
          </div>
        </div>
      </div>
    </div>
  )
}
