'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Eye, EyeOff, Store } from 'lucide-react'
import { loginPhone } from '../actions'

/** Real businesses: mobile number + password. New ones start the setup wizard. */
export function PhoneLogin() {
  const [state, action, pending] = useActionState(loginPhone, undefined)
  const [show, setShow] = useState(false)
  return (
    <div className="card p-4">
      <form action={action} className="space-y-3">
        <h2 className="font-semibold">Sign in to your business</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[12.5px] font-medium text-ink-2">Mobile number<input name="phone" inputMode="tel" autoComplete="username" required className="input num mt-1" placeholder="98220 12345" /></label>
          <label className="block text-[12.5px] font-medium text-ink-2">Password
            <span className="relative mt-1 block"><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="input pr-11" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted hover:text-ink">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
        </div>
        {state?.error && <p role="alert" className="text-[13px] text-bahi">{state.error}</p>}
        <button className="btn btn-primary h-11 w-full" disabled={pending}>{pending ? 'Opening…' : 'Sign in'}</button>
      </form>
      <Link href="/setup" className="mt-3 flex items-center gap-2 rounded-[10px] bg-paper-2 p-3 text-[13.5px] hover:bg-gold-soft">
        <Store className="size-4 text-bahi" /><span><b>New here?</b> Set up your business in 2 minutes</span><span className="ml-auto text-bahi">→</span></Link>
    </div>
  )
}
