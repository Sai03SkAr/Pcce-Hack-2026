'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { login } from '../actions'

type P = { id: number; name: string; role: string; title: string; sees: string; tone: string }

/** Tap your name, then your password. Only one card is open at a time. */
export function PeoplePicker({ people }: { people: P[] }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [show, setShow] = useState(false)
  const [state, action, pending] = useActionState(login, undefined)
  const pw = useRef<HTMLInputElement>(null)
  useEffect(() => { if (picked) pw.current?.focus() }, [picked, state])

  return (
    <ul className="mt-7 space-y-2.5">
      {people.map((u, i) => {
        const open = picked === u.id
        return (
          <li key={u.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
            <div className={`card overflow-hidden transition ${open ? 'border-line-2 shadow-[var(--shadow-lg)]' : 'hover:border-line-2'}`}>
              <button type="button" onClick={() => { setPicked(open ? null : u.id); setShow(false) }} aria-expanded={open}
                className="group flex w-full items-center gap-3.5 p-3.5 text-left">
                <span className={`grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${u.tone}`}>
                  {u.name.split(' ').slice(-2).map((p) => p[0]).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="font-semibold">{u.name}</span><span className="chip chip-grey">{u.role === 'ca' ? 'CA' : u.role[0].toUpperCase() + u.role.slice(1)}</span></span>
                  <span className="block text-[13px] text-ink-2">{u.title}</span>
                  <span className="block truncate text-[12.5px] text-muted">{u.sees}</span>
                </span>
                <span className={`text-muted transition ${open ? 'rotate-90 text-bahi' : 'group-hover:translate-x-0.5 group-hover:text-bahi'}`}>→</span>
              </button>
              {open && (
                <form action={action} className="rise border-t border-line bg-paper-2/50 p-3.5">
                  <input type="hidden" name="user" value={u.id} />
                  <label className="block text-[12.5px] font-medium text-ink-2">Password for {u.name.replace(/^CA /, '').split(' ')[0]}
                    <span className="relative mt-1 flex">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                      <input ref={pw} name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
                        className="input h-11 pl-9 pr-11" aria-invalid={!!state?.error} />
                      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[7px] text-muted hover:text-ink">
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    </span>
                  </label>
                  {state?.error && <p role="alert" className="mt-2 text-[13px] text-bahi">{state.error}</p>}
                  <button className="btn btn-primary mt-3 h-11 w-full" disabled={pending}>{pending ? 'Opening…' : 'Open the pedhi'}</button>
                </form>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
