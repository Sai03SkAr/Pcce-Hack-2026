'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { AlertTriangle, ArrowRightLeft, Check, Copy, ExternalLink, PackagePlus, Send, Sparkles, TrendingDown, Wallet, X } from 'lucide-react'
import { doTransfer, sendReminders, setInsightStatus } from '@/app/actions'
import type { Insight } from '@/lib/insights'

const ICON: Record<string, typeof AlertTriangle> = {
  sales_drop: TrendingDown, stockout: AlertTriangle, lowstock: PackagePlus, overdue: Wallet, deadstock: PackagePlus,
  margin_leak: TrendingDown, cash_short: Wallet, quiet_customer: TrendingDown, good: Sparkles,
}
const TONE = { high: 'text-bahi bg-bahi-soft', med: 'text-amber bg-amber-soft', good: 'text-leaf bg-leaf-soft' }
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

type Reminder = { name: string; text: string; wa: string; amount: number; sent: boolean }

export function InsightList({ items, lang, canAct }: { items: Insight[]; lang: 'en' | 'hi'; canAct: boolean }) {
  const [msg, setMsg] = useState<{ id: number; ok: boolean; text: string } | null>(null)
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const [, start] = useTransition()
  const t = (en: string, hi: string) => (lang === 'hi' ? hi : en)

  const run = (i: Insight, fn: () => Promise<any>) => {
    setBusy(i.id!)
    start(async () => {
      const r = await fn()
      setBusy(null)
      if (!r) return
      if (!r.ok) return setMsg({ id: i.id!, ok: false, text: r.error })
      if (Array.isArray(r.data)) setReminders(r.data)
      setMsg({ id: i.id!, ok: true, text: r.message ?? t('Done.', 'Ho gaya.') })
    })
  }
  const act = (i: Insight) => {
    const a = i.action
    if (!a) return null
    const label = t(a.label_en, a.label_hi)
    if (a.kind === 'view') return <Link href={a.href} className="btn btn-sm">{label}</Link>
    if (a.kind === 'reorder') return canAct ? <Link href={`/books/new?a=purchase&item=${a.item_id}&branch=${a.branch_id}&qty=${a.qty}`} className="btn btn-primary btn-sm"><PackagePlus className="size-3.5" />{label}</Link> : null
    if (!canAct) return null
    const Icon = a.kind === 'transfer' ? ArrowRightLeft : Send
    const go = () => run(i, () =>
      a.kind === 'transfer' ? doTransfer(a.item_id, a.from, a.to, a.qty, i.id) : sendReminders(a.customer_ids, i.id))
    return <button onClick={go} disabled={busy === i.id} className="btn btn-primary btn-sm"><Icon className="size-3.5" />{busy === i.id ? t('Working…', 'Ho raha hai…') : label}</button>
  }

  const open = items.filter((i) => i.status === 'open')
  const closed = items.filter((i) => i.status !== 'open')
  if (!items.length) return <p className="card p-6 text-center text-muted">{t('Nothing needs your attention. A quiet day at the pedhi.', 'Sab theek hai. Aaj koi dikkat nahi.')}</p>

  return (
    <div className="space-y-2.5">
      {(all ? open : open.slice(0, 5)).map((i, n) => {
        const Icon = ICON[i.type] ?? AlertTriangle
        return (
          <article key={i.id} className="card rise p-4" style={{ animationDelay: `${n * 40}ms` }}>
            <div className="flex gap-3.5">
              <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${TONE[i.severity]}`}><Icon className="size-[18px]" strokeWidth={2} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <h3 className="min-w-[min(100%,15rem)] flex-1 text-[15px] font-semibold leading-snug">{t(i.title_en, i.title_hi)}</h3>
                  {i.impact > 0 && <span className={`chip ${i.severity === 'high' ? 'chip-red' : 'chip-amber'} num`}>{fmt(i.impact)} {t('at stake', 'daav par')}</span>}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{t(i.detail_en, i.detail_hi)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {act(i)}
                  {i.severity !== 'good' && canAct && (
                    <span className="flex gap-1">{/* kept together so the × never wraps onto a line of its own */}
                      <button onClick={() => run(i, () => setInsightStatus(i.id!, 'done'))} className="btn btn-ghost btn-sm text-muted"><Check className="size-3.5" />{t('Handled', 'Ho gaya')}</button>
                      <button onClick={() => run(i, () => setInsightStatus(i.id!, 'dismissed'))} className="btn btn-ghost btn-sm text-muted" aria-label="Dismiss"><X className="size-3.5" /></button>
                    </span>
                  )}
                  {msg && msg.id === i.id && <span role="status" className={`text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</span>}
                </div>
              </div>
            </div>
          </article>
        )
      })}
      {open.length > 5 && <button onClick={() => setAll(!all)} className="btn btn-ghost w-full text-[13.5px] text-ink-2">{all ? t('Show fewer', 'Kam dikhao') : t(`Show ${open.length - 5} more`, `${open.length - 5} aur dikhao`)}</button>}
      {closed.length > 0 && (
        <details className="px-1 pt-1 text-[13px] text-muted">
          <summary className="cursor-pointer">{closed.length} {t('handled today', 'aaj nipte')}</summary>
          <ul className="mt-2 space-y-1">{closed.map((i) => <li key={i.id} className="flex items-center gap-2"><Check className="size-3.5 text-leaf" /><span className="line-through">{t(i.title_en, i.title_hi)}</span>
            <button className="ml-auto underline" onClick={() => run(i, () => setInsightStatus(i.id!, 'open'))}>{t('Reopen', 'Wapas kholo')}</button></li>)}</ul>
        </details>
      )}
      {reminders && <RemindersDialog items={reminders} onClose={() => setReminders(null)} lang={lang} />}
    </div>
  )
}

export function RemindersDialog({ items, onClose, lang }: { items: Reminder[]; onClose: () => void; lang: 'en' | 'hi' }) {
  const [copied, setCopied] = useState<number | null>(null)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Payment reminders" className="card rise max-h-[85dvh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="display text-xl font-semibold">{lang === 'hi' ? 'Reminder taiyaar' : 'Reminders ready'}</h2>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="Close"><X className="size-4" /></button></div>
        <p className="mt-1 text-[13.5px] text-muted">{items.some((i) => i.sent) ? 'Sent on WhatsApp.' : 'WhatsApp API is not connected in this demo, so open each one in WhatsApp to send it.'} Each has a UPI link for the exact amount.</p>
        <ul className="mt-4 space-y-3">
          {items.map((r, i) => (
            <li key={i} className="rounded-[12px] bg-wa-bg p-3">
              <div className="mb-2 flex items-center text-[13px] font-semibold">{r.name}<span className="ml-auto num">{'₹' + r.amount.toLocaleString('en-IN')}</span></div>
              <p className="whitespace-pre-wrap break-words rounded-[10px] rounded-tr-sm bg-wa-bubble p-2.5 text-[13px] leading-relaxed">{r.text}</p>
              <div className="mt-2 flex gap-2">
                {r.sent ? <span className="chip chip-green"><Check className="size-3" />Sent</span> : <a href={r.wa} target="_blank" rel="noreferrer" className="btn btn-sm"><ExternalLink className="size-3.5" />Open in WhatsApp</a>}
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(r.text); setCopied(i) }}><Copy className="size-3.5" />{copied === i ? 'Copied' : 'Copy'}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
