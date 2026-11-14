'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, Hammer, Pill, Plus, Shirt, ShoppingBasket, Smartphone, Store, Trash2, Truck } from 'lucide-react'
import { startBusiness } from '../actions'
import { Wordmark } from '@/components/Logo'

type T = { id: string; label: string; hint: string; expiry: boolean; items: string[] }
const ICON: Record<string, typeof Store> = { hardware: Hammer, kirana: ShoppingBasket, pharmacy: Pill, clothing: Shirt, electronics: Smartphone, wholesale: Truck, other: Store }
const STEPS = ['Your business', 'About you', 'Branches', 'Items']

export function SetupWizard({ types, states }: { types: T[]; states: string[] }) {
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState('')
  const [f, setF] = useState({ name: '', owner: '', phone: '', password: '', state: 'Goa', gstin: '', upi: '' })
  const [show, setShow] = useState(false)
  const [branches, setBranches] = useState(['Main shop'])
  const [starter, setStarter] = useState(true)
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const type = types.find((t) => t.id === kind)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const digits = f.phone.replace(/\D/g, '')

  const can = [!!kind, f.name.trim().length > 1 && f.owner.trim().length > 1 && (digits.length === 10 || digits.length === 12) && f.password.length >= 6,
    branches.some((b) => b.trim()), true][step]
  const next = () => { setErr(''); setStep(step + 1) }
  const finish = () => start(async () => {
    setErr('')
    const r = await startBusiness({ kind, ...f, branches, starter: starter && !!type?.items.length })
    if (r?.error) setErr(r.error)
  })

  return (
    <main className="min-h-dvh px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center">
          <Wordmark />
          <Link href="/login" className="ml-auto text-[13.5px] text-muted hover:text-ink">I already have a login</Link>
        </div>

        <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-bahi' : 'bg-line-2'}`} />
              <p className={`mt-1.5 text-[12px] font-medium ${i === step ? 'text-ink' : 'text-muted'}`}>{s}</p>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="rise mt-8">
            <h1 className="display text-[30px] font-semibold leading-tight sm:text-[34px]">What kind of business is this?</h1>
            <p className="mt-2 text-ink-2">Pedhi sets up the right categories, units and a starter item list for you. You can change everything later.</p>
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {types.map((t) => {
                const I = ICON[t.id] ?? Store, on = kind === t.id
                return (
                  <button key={t.id} type="button" onClick={() => setKind(t.id)} aria-pressed={on}
                    className={`card flex items-start gap-3 p-4 text-left transition ${on ? 'border-bahi ring-2 ring-bahi/30' : 'hover:border-line-2'}`}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${on ? 'bg-bahi text-[#fff6e6]' : 'bg-paper-2 text-ink-2'}`}><I className="size-5" /></span>
                    <span className="min-w-0"><span className="block font-semibold leading-snug">{t.label}</span><span className="block text-[13px] text-muted">{t.hint}</span></span>
                    {on && <Check className="ml-auto size-5 shrink-0 text-bahi" />}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="rise mt-8 space-y-4">
            <div><h1 className="display text-[30px] font-semibold leading-tight">About your business</h1>
              <p className="mt-2 text-ink-2">The owner signs in with this mobile number and password. Add family and staff later under People.</p></div>
            <label className="block text-[13.5px] font-medium">Business name<input value={f.name} onChange={set('name')} className="input mt-1" placeholder="Shree Ganesh Traders" autoFocus /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[13.5px] font-medium">Owner’s name<input value={f.owner} onChange={set('owner')} className="input mt-1" placeholder="Prakash Shetty" /></label>
              <label className="block text-[13.5px] font-medium">Owner’s mobile<input value={f.phone} onChange={set('phone')} inputMode="tel" className="input num mt-1" placeholder="98220 12345" /></label>
            </div>
            <label className="block text-[13.5px] font-medium">Password<span className="font-normal text-muted"> · at least 6 characters</span>
              <span className="relative mt-1 block"><input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} autoComplete="new-password" className="input pr-11" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted hover:text-ink">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-[13.5px] font-medium">State<select value={f.state} onChange={set('state')} className="input mt-1">{[...states, 'Other'].map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="block text-[13.5px] font-medium">GSTIN<span className="font-normal text-muted"> · optional</span><input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} className="input num mt-1" placeholder="30ABCDE1234F1Z5" /></label>
              <label className="block text-[13.5px] font-medium">UPI ID<span className="font-normal text-muted"> · optional</span><input value={f.upi} onChange={set('upi')} className="input mt-1" placeholder="shop@okhdfcbank" /></label>
            </div>
            <p className="text-[12.5px] text-muted">The state decides CGST and SGST versus IGST on bills. The UPI ID goes on reminders so customers can pay with one tap.</p>
          </section>
        )}

        {step === 2 && (
          <section className="rise mt-8">
            <h1 className="display text-[30px] font-semibold leading-tight">Your branches</h1>
            <p className="mt-2 text-ink-2">One shop is fine. Each branch gets its own stock, cash box and bill numbers; you see them all together.</p>
            <ul className="mt-5 space-y-2">
              {branches.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <input value={b} onChange={(e) => setBranches(branches.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Branch ${i + 1} name`} className="input" placeholder="Station Road" />
                  {branches.length > 1 && <button type="button" onClick={() => setBranches(branches.filter((_, j) => j !== i))} className="btn btn-ghost" aria-label={`Remove branch ${i + 1}`}><Trash2 className="size-4" /></button>}
                </li>
              ))}
            </ul>
            {branches.length < 20 && <button type="button" onClick={() => setBranches([...branches, ''])} className="btn btn-sm mt-3"><Plus className="size-3.5" />Add a branch</button>}
          </section>
        )}

        {step === 3 && type && (
          <section className="rise mt-8">
            <h1 className="display text-[30px] font-semibold leading-tight">Your items</h1>
            {type.items.length > 0 ? (
              <>
                <p className="mt-2 text-ink-2">Start with common {type.label.toLowerCase()} items, or start empty and import your own stock sheet.</p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {([[true, 'Load starter items', `${type.items.length} items with usual prices and GST rates. Edit or delete any.`], [false, 'Start empty', 'Add items one by one, or import your Excel sheet.']] as const).map(([v, l, d]) => (
                    <button key={l} type="button" onClick={() => setStarter(v)} aria-pressed={starter === v}
                      className={`card p-4 text-left ${starter === v ? 'border-bahi ring-2 ring-bahi/30' : ''}`}><span className="block font-semibold">{l}</span><span className="block text-[13px] text-muted">{d}</span></button>))}
                </div>
                {starter && <p className="mt-4 text-[13px] text-ink-2"><b>Includes:</b> {type.items.join(', ')}.</p>}
                <p className="mt-2 text-[12.5px] text-muted">Starter GST rates are a guide only; ask your CA to confirm them.{type.expiry ? ' Expiry dates are tracked when stock comes in.' : ''}</p>
              </>
            ) : <p className="mt-2 text-ink-2">You’ll start empty. Add items under Stock, or import your Excel sheet.</p>}
            <div className="card mt-6 p-4 text-[14px]">
              <p className="font-semibold">{f.name || 'Your business'}</p>
              <p className="text-ink-2">{type.label} · {branches.filter((b) => b.trim()).length} branch{branches.filter((b) => b.trim()).length > 1 ? 'es' : ''} · {f.state}</p>
              <p className="text-ink-2">Owner: {f.owner} · {f.phone}</p>
            </div>
          </section>
        )}

        {err && <p role="alert" className="mt-5 rounded-[10px] bg-bahi-soft p-3 text-[13.5px] text-bahi">{err}</p>}
        <div className="mt-8 flex gap-2">
          {step > 0 && <button type="button" className="btn btn-lg" onClick={() => { setErr(''); setStep(step - 1) }} disabled={pending}><ArrowLeft className="size-4" />Back</button>}
          {step < 3
            ? <button type="button" className="btn btn-primary btn-lg ml-auto" onClick={next} disabled={!can}>Continue</button>
            : <button type="button" className="btn btn-primary btn-lg ml-auto" onClick={finish} disabled={pending}>{pending ? 'Setting up…' : 'Create my pedhi'}</button>}
        </div>
      </div>
    </main>
  )
}
