'use client'
import { useState, useTransition } from 'react'
import { UserPlus, X } from 'lucide-react'
import { bookAddCustomer } from '@/app/actions'

export type NewCust = { id: number; name: string; branch_id: number; credit_limit: number }

/** Add a customer: name and phone are enough at the counter; family and managers can also set a credit limit and GSTIN. */
export function NewCustomerDialog({ initialName = '', branches, defaultBranch, canSetLimit, onClose, onCreated }: {
  initialName?: string; branches: { id: number; name: string }[]; defaultBranch: number; canSetLimit: boolean
  onClose: () => void; onCreated: (c: NewCust) => void
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [branch, setBranch] = useState(defaultBranch)
  const [limit, setLimit] = useState(canSetLimit ? '25000' : '0')
  const [gstin, setGstin] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const save = () => start(async () => {
    setErr('')
    const r = await bookAddCustomer({ name, phone, branchId: branch, creditLimit: parseInt(limit) || 0, gstin })
    if (!r.ok) return setErr(r.error)
    onCreated(r.data as NewCust)
  })
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="New customer" className="card rise w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="flex items-center"><h2 className="display text-xl font-semibold">New customer</h2>
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="Close"><X className="size-4" /></button></div>
        <label className="block text-[13px] font-medium">Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Pai Constructions" /></label>
        <label className="block text-[13px] font-medium">Mobile<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="input num mt-1" placeholder="98220 12345" /></label>
        {branches.length > 1 && (
          <label className="block text-[13px] font-medium">Buys from<select value={branch} onChange={(e) => setBranch(+e.target.value)} className="input mt-1">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        )}
        {canSetLimit ? (
          <>
            <label className="block text-[13px] font-medium">Udhaar limit (₹)<input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1" /></label>
            <label className="block text-[13px] font-medium">GSTIN <span className="font-normal text-muted">if a registered business</span>
              <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} className="input num mt-1" placeholder="30ABCDE1234F1Z5" /></label>
          </>
        ) : <p className="text-[12.5px] text-muted">New customers start on cash or UPI. The owner can allow udhaar later.</p>}
        {err && <p role="alert" className="rounded-[8px] bg-bahi-soft p-2.5 text-[13px] text-bahi">{err}</p>}
        <button className="btn btn-primary w-full" disabled={pending || name.trim().length < 2}><UserPlus className="size-4" />{pending ? 'Adding…' : 'Add customer'}</button>
      </form>
    </div>
  )
}

export function NewCustomerButton(props: { branches: { id: number; name: string }[]; defaultBranch: number; canSetLimit: boolean }) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState('')
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}><UserPlus className="size-3.5" />New customer</button>
      {added && <span role="status" className="text-[13px] text-leaf">{added} added.</span>}
      {open && <NewCustomerDialog {...props} onClose={() => setOpen(false)} onCreated={(c) => { setOpen(false); setAdded(c.name) }} />}
    </>
  )
}
