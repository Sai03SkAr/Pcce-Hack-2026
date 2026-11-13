'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Keeps every open screen current: when anyone at any counter saves something, this page reloads its data. */
export function Live() {
  const router = useRouter()
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    let last: number | null = null
    const check = async () => {
      if (document.hidden) return
      const v = await fetch('/api/live', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.v as number).catch(() => null)
      if (v === null) return
      if (last !== null && v !== last) { router.refresh(); setFresh(true); setTimeout(() => setFresh(false), 2500) }
      last = v
    }
    check()
    const id = setInterval(check, 8000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [router])
  return (
    <span title="Live: sales, stock and payments from every branch show up here on their own" className="hidden items-center gap-1.5 text-[12px] font-medium text-muted sm:flex">
      <span className={`size-2 rounded-full bg-leaf ${fresh ? 'animate-ping' : ''}`} />{fresh ? 'Updated' : 'Live'}
    </span>
  )
}
