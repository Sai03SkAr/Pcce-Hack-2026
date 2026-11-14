'use client'
import { useState, useTransition } from 'react'
import { UserPlus } from 'lucide-react'
import { addPerson } from '@/app/actions'

const ROLES = [['staff', 'Counter staff', 'Bills and payments at one branch. Never sees cost or profit.'], ['manager', 'Branch manager', 'Runs one branch: stock, deliveries, transfers.'],
  ['family', 'Family', 'Sees every branch, profit and books.'], ['ca', 'CA', 'Reads the books and GST, signs off periods.']] as const

export function AddPerson({ branches }: { branches: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', role: 'staff', branchId: branches[0]?.id ?? 0, phone: '', password: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const needsBranch = f.role === 'staff' || f.role === 'manager'
  if (!open) return <button className="btn" onClick={() => setOpen(true)}><UserPlus className="size-4" />Add a person</button>
  return (
    <form className="card space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await addPerson({ ...f, branchId: needsBranch ? f.branchId : null })
      setMsg({ ok: r.ok, text: r.ok ? r.message! : r.error })
      if (r.ok) setF({ ...f, name: '', phone: '', password: '' })
    }) }}>
      <h2 className="font-semibold">Add a person</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map(([k, l, d]) => (
          <button key={k} type="button" onClick={() => setF({ ...f, role: k })} aria-pressed={f.role === k}
            className={`rounded-[10px] border p-3 text-left ${f.role === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>
            <span className="block text-[13.5px] font-semibold">{l}</span><span className={`block text-[12px] ${f.role === k ? 'text-paper/75' : 'text-muted'}`}>{d}</span></button>))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-medium">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input mt-1" placeholder="Full name" /></label>
        {needsBranch && <label className="text-[13px] font-medium">Branch<select value={f.branchId} onChange={(e) => setF({ ...f, branchId: +e.target.value })} className="input mt-1">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
        <label className="text-[13px] font-medium">Mobile (their login and WhatsApp)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" className="input num mt-1" placeholder="98220 12345" /></label>
        <label className="text-[13px] font-medium">First password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" className="input mt-1" placeholder="at least 6 characters" /></label>
      </div>
      {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add person'}</button><button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setMsg(null) }}>Close</button></div>
    </form>
  )
}
