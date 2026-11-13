'use client'
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/** "Install app": the browser's own install prompt on Android/desktop Chrome, a short hint on iPhone. Hidden once installed. */
export function InstallApp({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<any>(null)
  const [ios, setIos] = useState(false)
  const [hint, setHint] = useState(false)
  const [installed, setInstalled] = useState(true)
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    setInstalled(!!standalone)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  if (installed || (!prompt && !ios)) return null
  return (
    <div className={className}>
      <button type="button" className="btn btn-sm w-full" onClick={async () => {
        if (prompt) { prompt.prompt(); await prompt.userChoice; setPrompt(null) } else setHint(!hint)
      }}><Download className="size-4" />Install app</button>
      {hint && <p className="mt-1.5 text-[12px] text-muted">In Safari, tap Share, then “Add to Home Screen”.</p>}
    </div>
  )
}
