'use client'
import { useState, useTransition } from 'react'
import { KeyRound, MessageCircle } from 'lucide-react'
import { setPassword, setUserPhone } from '@/app/actions'

type P = { id: number; name: string; title: string; role: string; phone: string }
const pretty = (d: string) => (d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : d ? '+' + d : '')

export function PeopleAccess({ people, family, meId, waLive }: { people: P[]; family: boolean; meId: number; waLive: boolean }) {
  return (
    <>
      {family && <p className={`card flex items-start gap-2 p-3 text-[13px] ${waLive ? 'text-leaf' : 'text-ink-2'}`}><MessageCircle className="mt-0.5 size-4 shrink-0" />
        {waLive ? 'Real WhatsApp is connected. Messages from these numbers reach Pedhi.' : 'Real WhatsApp is not connected yet, so numbers are used by the WhatsApp simulator. See PEDHI_GUIDE.md step 6.'}</p>}
      <ul className="card divide-y divide-line">{people.map((p) => <Row key={p.id} p={p} family={family} me={p.id === meId} />)}</ul>
    </>
  )
}

function Row({ p, family, me }: { p: P; family: boolean; me: boolean }) {
  const [phone, setPhone] = useState(pretty(p.phone))
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const done = (r: { ok: boolean; error?: string; message?: string }) => setMsg({ ok: r.ok, text: r.ok ? r.message! : r.error! })
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{p.name}</span>{me && <span className="chip chip-gold">you</span>}
        <span className="w-full text-[12.5px] text-muted sm:w-auto">{p.title}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {family && (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => done(await setUserPhone(p.id, phone))) }}>
            <label className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-2">WhatsApp number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="input num mt-1" placeholder="98220 12345" /></label>
            <button className="btn h-[38px]" disabled={pending || phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') === p.phone}>Save</button>
          </form>
        )}
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setPassword(p.id, pw); done(r); if (r.ok) setPw('') }) }}>
          <label className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-2">{me ? 'New password' : 'Set a new password'}
            <span className="relative mt-1 block"><KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="input pl-9" placeholder="at least 6 characters" /></span></label>
          <button className="btn h-[38px]" disabled={pending || pw.length < 6}>Change</button>
        </form>
      </div>
      {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p>}
    </li>
  )
}
