'use client'
import { useState, useTransition } from 'react'
import { BellRing } from 'lucide-react'
import { runAutoRemindersNow, saveAutoReminders } from '@/app/actions'
import { RemindersDialog } from '@/components/Insights'

/** Owner switches on reminders that go out by themselves every morning; "Send now" runs today's batch. */
export function AutoReminders({ on: on0, after: a0, every: e0, waLive }: { on: boolean; after: number; every: number; waLive: boolean }) {
  const [on, setOn] = useState(on0)
  const [after, setAfter] = useState(String(a0))
  const [every, setEvery] = useState(String(e0))
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState<any[] | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <BellRing className={`size-5 ${on ? 'text-leaf' : 'text-muted'}`} />
        <div className="min-w-0 flex-1"><div className="font-semibold">Automatic reminders</div>
          <div className="text-[12.5px] text-muted">{on ? `On: every morning, to customers ${after} days past their credit period, repeating every ${every} days.` : 'Off. Reminders go only when someone presses Remind.'}{!waLive && ' WhatsApp is not connected, so they are prepared for you to send.'}</div></div>
        <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { const r = await runAutoRemindersNow(); if (r.ok) { setSent(r.data as any[]); setMsg((r.data as any[]).length ? '' : 'No one is due a reminder today.') } else setMsg(r.error) })}>Send today’s now</button>
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveAutoReminders(on, parseInt(after) || 0, parseInt(every) || 7); setMsg(r.ok ? 'Saved.' : r.error) }) }}>
        <label className="flex items-center gap-2 text-[13px] font-medium"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-[var(--bahi)]" />Send automatically</label>
        <label className="text-[12.5px] font-medium text-ink-2">Days after credit period<input value={after} onChange={(e) => setAfter(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1 h-9 w-24" /></label>
        <label className="text-[12.5px] font-medium text-ink-2">Repeat every (days)<input value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1 h-9 w-24" /></label>
        <button className="btn btn-sm h-9" disabled={pending}>Save</button>
        {msg && <span role="status" className="pb-2 text-[13px] text-ink-2">{msg}</span>}
      </form>
      {sent && sent.length > 0 && <RemindersDialog items={sent} lang="hi" onClose={() => setSent(null)} />}
    </div>
  )
}
