'use client'
import { useState, useTransition } from 'react'
import { DatabaseBackup, Upload } from 'lucide-react'
import { restoreBackup } from '@/app/actions'

export function Backup({ isOwner }: { isOwner: boolean }) {
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><DatabaseBackup className="size-5 text-gold" />Your data</h2>
      <p className="mt-1 text-[13.5px] text-ink-2">Download everything (bills, stock, khata, books) as one backup file. Keep it on a pen drive or Google Drive every week. It can be restored on any computer.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/api/backup" className="btn btn-primary btn-sm"><DatabaseBackup className="size-4" />Download backup</a>
        {isOwner && (
          <label className="btn btn-sm cursor-pointer"><Upload className="size-4" />{pending ? 'Restoring…' : 'Restore from a backup'}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f || !confirm('Restoring replaces ALL current data with the backup. Continue?') || !confirm('Are you sure? Anything entered after that backup will be lost.')) return
              const text = await f.text()
              start(async () => { const r = await restoreBackup(text); if (r && !r.ok) setErr(r.error) })
            }} /></label>
        )}
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] text-bahi">{err}</p>}
    </section>
  )
}
