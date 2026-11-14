'use client'
import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'

type Step = { label: string; ok: boolean; hint: string }

/** The owner's checklist for real WhatsApp: what is set, and the two values to paste into Meta. */
export function WhatsAppSetup({ steps, callback, verify }: { steps: Step[]; callback: string; verify: string }) {
  const done = steps.every((s) => s.ok)
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Connect real WhatsApp</h2>
        <span className={`chip ${done ? 'chip-green' : 'chip-amber'}`}>{done ? 'Connected' : `${steps.filter((s) => s.ok).length} of ${steps.length} set`}</span>
      </div>
      <ul className="mt-3 space-y-2 text-[13.5px]">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-2">
            <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${s.ok ? 'bg-leaf-soft text-leaf' : 'bg-paper-2 text-muted'}`}>{s.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>
            <span><b className="font-semibold">{s.label}</b><span className="block text-[12.5px] text-muted">{s.hint}</span></span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        <p className="text-[12.5px] text-ink-2">In Meta → WhatsApp → Configuration → Webhook, paste these two, press Verify and save, then subscribe to <b>messages</b>:</p>
        <CopyRow label="Callback URL" value={callback} />
        <CopyRow label="Verify token" value={verify} />
        <p className="text-[12px] text-muted">The callback URL changes whenever the tunnel link changes. Paste the new one into Meta each time.</p>
      </div>
    </section>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-paper-2 p-2 pl-3">
      <span className="min-w-0 flex-1"><span className="block text-[11.5px] text-muted">{label}</span><span className="block truncate font-mono text-[12.5px]">{value || 'not set'}</span></span>
      {value && <button type="button" className="btn btn-sm shrink-0" onClick={async () => { await navigator.clipboard?.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}</button>}
    </div>
  )
}
