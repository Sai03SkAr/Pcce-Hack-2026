'use client'
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetDemo } from '@/app/actions'

/** Two taps, because a reset rebuilds the whole demo database. (The browser's confirm() is blocked in some app views.) */
export function ResetDemo() {
  const [sure, setSure] = useState(false)
  if (!sure) return <button onClick={() => setSure(true)} className="flex w-full items-center gap-2 px-2.5 text-[12px] text-muted hover:text-bahi"><RotateCcw className="size-3.5" />Reset demo data</button>
  return (
    <form action={resetDemo} className="space-y-1.5 rounded-[10px] bg-bahi-soft p-2.5 text-[12px] text-bahi">
      <p>Restore the Naik Traders story? Any other business set up on this server is removed too.</p>
      <div className="flex gap-1.5"><button className="btn btn-primary btn-sm">Reset</button><button type="button" onClick={() => setSure(false)} className="btn btn-ghost btn-sm">Cancel</button></div>
    </form>
  )
}
