'use client'
import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendReminders } from '@/app/actions'
import { RemindersDialog } from '@/components/Insights'

export function RemindButton({ ids, lang, label, primary }: { ids: number[]; lang: 'en' | 'hi'; label: string; primary?: boolean }) {
  const [items, setItems] = useState<any[] | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      <button disabled={pending} className={`btn btn-sm ${primary ? 'btn-primary' : ''}`} onClick={() => start(async () => { const r = await sendReminders(ids); if (r.ok) setItems(r.data as any[]) })}>
        <Send className="size-3.5" />{pending ? 'Preparing…' : label}
      </button>
      {items && <RemindersDialog items={items} lang={lang} onClose={() => setItems(null)} />}
    </>
  )
}
