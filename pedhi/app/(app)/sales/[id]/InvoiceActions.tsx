'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Printer, Undo2 } from 'lucide-react'
import { cancelSale } from '@/app/actions'

export function InvoiceActions({ id, canUndo }: { id: number; canUndo: boolean }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')
  const router = useRouter()
  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[13px] text-bahi">{err}</span>}
      {canUndo && <button className="btn btn-sm" disabled={pending} onClick={() => confirm('Cancel this bill and return the stock?') && start(async () => {
        const r = await cancelSale(id)
        if (r.ok) router.push('/sales'); else setErr(r.error)
      })}><Undo2 className="size-4" />Cancel bill</button>}
      <button className="btn btn-sm" onClick={() => window.print()}><Printer className="size-4" />Print</button>
    </div>
  )
}
