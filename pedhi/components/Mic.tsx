'use client'
import { useEffect, useRef, useState } from 'react'
import { Mic as MicIcon, MicOff } from 'lucide-react'

/** Browser speech recognition (Chrome, Edge, Safari). Hidden where the browser has none. */
export function Mic({ onText, lang = 'en-IN', className = '' }: { onText: (t: string) => void; lang?: string; className?: string }) {
  const [on, setOn] = useState(false)
  const rec = useRef<any>(null)
  const [SR, setSR] = useState<any>(null)
  useEffect(() => { setSR(() => (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null) }, [])
  if (!SR) return null
  const toggle = () => {
    if (on) return rec.current?.stop()
    const r = new SR()
    r.lang = lang
    r.interimResults = false
    r.onresult = (e: any) => onText(e.results[0][0].transcript)
    r.onend = () => setOn(false)
    r.onerror = () => setOn(false)
    rec.current = r
    r.start()
    setOn(true)
  }
  return (
    <button type="button" onClick={toggle} aria-label={on ? 'Stop listening' : 'Speak'} title={on ? 'Listening… tap to stop' : 'Speak (Hindi or English)'}
      className={`btn ${on ? 'border-bahi bg-bahi text-white animate-pulse' : ''} ${className}`}>
      {on ? <MicOff className="size-4" /> : <MicIcon className="size-4" />}
    </button>
  )
}
