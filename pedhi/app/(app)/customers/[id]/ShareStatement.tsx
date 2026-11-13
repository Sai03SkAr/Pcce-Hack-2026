'use client'
import { useState, useTransition } from 'react'
import { Copy, ExternalLink, RefreshCw, Share2, X } from 'lucide-react'
import { shareStatement } from '@/app/actions'

/** Creates the customer's private khata link and sends it on WhatsApp. */
export function ShareStatement({ customerId, phone, name, balance }: { customerId: number; phone: string | null; name: string; balance: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const get = (renew = false) => start(async () => {
    const r = await shareStatement(customerId, renew)
    if (r.ok) { setUrl(r.data as string); setErr('') } else setErr(r.error)
  })
  const text = url ? `Namaste ${name}, here is your account statement${balance > 0 ? ` (₹${balance.toLocaleString('en-IN')} due)` : ''}: ${url}` : ''
  return (
    <>
      <button className="btn btn-sm" disabled={pending} onClick={() => get()}><Share2 className="size-3.5" />Share khata</button>
      {(url || err) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => { setUrl(null); setErr('') }}>
          <div role="dialog" aria-modal="true" aria-label="Share khata" className="card rise w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h2 className="display text-xl font-semibold">Share khata with {name.split(' ')[0]}</h2>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { setUrl(null); setErr('') }} aria-label="Close"><X className="size-4" /></button></div>
            {err ? <p className="text-[13px] text-bahi">{err}</p> : <>
              <p className="text-[13px] text-ink-2">A private link to their statement: every bill and payment, what is due, and a UPI button to pay. No login needed. Anyone with the link can see it.</p>
              <div className="break-all rounded-[10px] bg-paper-2 p-3 font-mono text-[12px]">{url}</div>
              <div className="flex flex-wrap gap-2">
                {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm"><Share2 className="size-3.5" />Send on WhatsApp</a>}
                <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(url!); setCopied(true) }}><Copy className="size-3.5" />{copied ? 'Copied' : 'Copy link'}</button>
                <a href={url!} target="_blank" rel="noreferrer" className="btn btn-sm"><ExternalLink className="size-3.5" />Open</a>
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => get(true)}><RefreshCw className="size-3.5" />New link (old one stops working)</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </>
  )
}
