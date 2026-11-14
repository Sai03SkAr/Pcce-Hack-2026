'use client'
import Link from 'next/link'
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { CheckCheck, Radio, SendHorizontal, Sunrise } from 'lucide-react'
import { pushBrief, simulateMessage } from '@/app/actions'
import { WaText } from '@/components/BriefCard'
import { Mic } from '@/components/Mic'

type M = { id: number; dir: 'in' | 'out'; body: string; ts: string }
type P = { id: number; name: string; title: string; role: string; phone?: string; lang?: string }

export function Simulator({ me, people, as, msgs, samples, live, org }: { me: { id: number; family: boolean }; people: P[]; as: P; msgs: M[]; samples: string[]; live: boolean; org: string }) {
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const [shown, addOptimistic] = useOptimistic(msgs, (s, m: M) => [...s, m])
  const [note, setNote] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [shown.length, pending])

  const send = (t: string) => {
    if (!t.trim()) return
    setText('')
    start(async () => {
      addOptimistic({ id: -Date.now(), dir: 'in', body: t, ts: new Date().toISOString().replace('T', ' ') })
      const r = await simulateMessage(as.id, t)
      if (!r.ok) setNote(r.error)
    })
  }
  const owner = people.find((p) => p.role === 'owner')

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,420px)] xl:grid-cols-[260px_minmax(0,420px)_minmax(0,1fr)]">
      <section>
        <h1 className="display text-[30px] font-semibold leading-tight">The counter, on chat</h1>
        <p className="mt-2 hidden text-[13.5px] text-ink-2 sm:block">Staff send a sale or a payment the way they already text. Pedhi books it, updates stock and udhaar, and replies.</p>
        {me.family && (
          <ul className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mt-5 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
            {people.map((p) => (
              <li key={p.id} className={`shrink-0 ${p.id === as.id ? 'order-first lg:order-none' : ''}`}><Link href={`/whatsapp?as=${p.id}`} className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 ${p.id === as.id ? 'bg-card ring-1 ring-line shadow-[var(--shadow)]' : 'hover:bg-card/60'}`}>
                <span className="grid size-8 place-items-center rounded-full bg-wa text-[12px] font-semibold text-white">{p.name.split(' ').map((x) => x[0]).join('')}</span>
                <span className="min-w-0 leading-tight"><span className="block truncate text-[13.5px] font-semibold">{p.name}</span><span className="hidden truncate text-[12px] text-muted lg:block">{p.title}</span></span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto w-full max-w-[420px]">
        <div className="overflow-hidden rounded-[18px] border border-line bg-wa-bg shadow-[var(--shadow-lg)] sm:rounded-[34px] sm:border-[7px] sm:border-ink">
          <div className="flex items-center gap-2.5 bg-wa px-4 pb-2.5 pt-4 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white/15 text-[14px] font-semibold">पे</span>
            <div className="leading-tight"><div className="text-[15px] font-semibold">Pedhi · {org}</div><div className="text-[11.5px] text-white/75">{pending ? 'typing…' : `chatting as ${as.name}`}</div></div>
          </div>
          <div className="h-[calc(100dvh-430px)] min-h-[220px] space-y-2 sm:h-[52dvh] sm:min-h-[360px] overflow-y-auto px-3 py-4" style={{ backgroundImage: 'radial-gradient(color-mix(in oklab, var(--line-2) 55%, transparent) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
            {!shown.length && <p className="mx-auto mt-10 max-w-[260px] rounded-[10px] bg-card/90 p-3 text-center text-[12.5px] text-muted">No messages yet. Tap a sample below, or type like you would on WhatsApp.</p>}
            {shown.map((m) => (
              <div key={m.id} className={`flex ${m.dir === 'in' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] rounded-[12px] px-3 py-2 text-[13.5px] leading-[1.45] shadow-[0_1px_0.5px_rgb(0_0_0/0.12)] ${m.dir === 'in' ? 'rounded-tr-sm bg-wa-bubble' : 'rounded-tl-sm bg-card'}`}>
                  <WaText text={m.body} />
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-muted">{m.ts.slice(11, 16)}{m.dir === 'in' && <CheckCheck className="size-3.5 text-sky-500" />}</div>
                </div>
              </div>
            ))}
            {pending && <div className="flex"><div className="typing flex gap-1 rounded-[12px] bg-card px-3 py-3">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 rounded-full bg-muted" />)}</div></div>}
            <div ref={end} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">{samples.map((s) => <button key={s} onClick={() => send(s)} disabled={pending} className="shrink-0 rounded-full border border-line-2 bg-card px-3 py-1 text-[12px] text-ink-2 hover:border-wa">{s}</button>)}</div>
          <form className="flex items-center gap-1.5 bg-wa-bg px-2 pb-3" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <input value={text} onChange={(e) => setText(e.target.value)} className="h-10 flex-1 rounded-full bg-card px-4 text-[14px] outline-none" placeholder="Message" aria-label="Message" />
            <Mic onText={send} lang={as.lang === 'hi' ? 'hi-IN' : 'en-IN'} className="size-10 rounded-full border-0 bg-card p-0" />
            <button disabled={pending || !text.trim()} className="grid size-10 place-items-center rounded-full bg-wa text-white disabled:opacity-60" aria-label="Send"><SendHorizontal className="size-[18px]" /></button>
          </form>
        </div>
        {note && <p role="alert" className="mt-2 text-center text-[13px] text-bahi">{note}</p>}
      </section>

      <section className="space-y-3 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:col-span-1 xl:block xl:space-y-3">
        {me.family && owner && (
          <div className="card p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Sunrise className="size-4 text-gold" />7:00 am brief</h2>
            <p className="mt-1 text-[13px] text-ink-2">Every morning each family member gets their brief on WhatsApp. Send today’s now:</p>
            <div className="mt-3 flex flex-wrap gap-2">{people.filter((p) => p.role !== 'staff').map((p) => (
              <button key={p.id} disabled={pending} className="btn btn-sm" onClick={() => start(async () => { const r = await pushBrief(p.id); setNote(r.ok ? (r.data.sent ? `Brief sent to ${p.name} on WhatsApp.` : `Brief added to ${p.name}’s chat.`) : r.error) })}>
                {p.name.split(' ')[0]}</button>))}</div>
          </div>
        )}
        <div className="card p-4 text-[13px]">
          <h2 className="flex items-center gap-2 font-semibold"><Radio className={`size-4 ${live ? 'text-leaf' : 'text-muted'}`} />{live ? 'Live WhatsApp connected' : 'Simulator mode'}</h2>
          <p className="mt-1 text-ink-2">{live ? 'Messages to the business number are handled by the same code you see here.' : 'This chat runs the exact handler the WhatsApp Cloud API webhook uses. Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_VERIFY_TOKEN, then point Meta’s webhook at /api/whatsapp.'}</p>
        </div>
        {me.family && <div className="card p-4 text-[13px] text-ink-2"><h2 className="font-semibold text-ink">WhatsApp numbers</h2><p className="mt-1">Only registered numbers can talk to Pedhi. Set each person's number and password under <Link href="/team" className="font-semibold text-bahi">People</Link>.</p></div>}
        <div className="card p-4 text-[13px] text-ink-2">
          <h2 className="font-semibold text-ink">What it understands</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Sales: “Ramesh ko 10 bori ACC cement udhaar”</li><li>Payments: “Kamat ne 15000 UPI se diye”</li>
            <li>Stock in: “50 bori ACC cement aaya exp 03/2027”. A new item? Pedhi asks before adding it.</li>
            <li>Questions: “Aaj kitni sale hui?”, “Kya expire hone wala hai?”</li><li>“undo” cancels your last WhatsApp bill · “brief” for today’s brief</li>
          </ul>
          <p className="mt-2 font-medium text-ink">Pedhi shows what it understood first. Nothing is saved until the sender replies YES.</p>
          <p className="mt-2 text-muted">Only registered numbers can record anything. Credit limits and branch rules apply here too.</p>
        </div>
      </section>
    </div>
  )
}

