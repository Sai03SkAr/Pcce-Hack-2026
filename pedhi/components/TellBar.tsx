'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Wand2 } from 'lucide-react'
import { bookParse } from '@/app/actions'
import { Mic } from './Mic'

const EXAMPLES = ['HDFC se 4,500 bijli ka bill bhara', 'Goa Cement se 200 bag ACC cement liya udhaar', '50000 cash HDFC mein jama kiya', 'Paid Konkan Steel 1,20,000 from HDFC', 'Ghar ke liye 10000 cash liye']

export function TellBar() {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (t: string) => {
    setText(t); setErr('')
    start(async () => {
      const d = await bookParse(t)
      if (d.action === 'unknown') return setErr('I could not tell what that was. Pick an action below, or try one of the examples.')
      router.push(`/books/new?a=${d.action}&d=${encodeURIComponent(JSON.stringify(d))}`)
    })
  }
  return (
    <div className="card p-4">
      <label htmlFor="tell" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><Wand2 className="size-4 text-gold" />Tell Pedhi what happened. It fills the form; you check and save.</label>
      <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) go(text) }}>
        <input id="tell" value={text} onChange={(e) => setText(e.target.value)} className="input h-11 text-[15px]" placeholder="HDFC se 4500 bijli ka bill bhara" />
        <Mic onText={go} lang="hi-IN" className="h-11 w-11 p-0" />
        <button className="btn btn-primary h-11" disabled={pending || !text.trim()}>{pending ? 'Reading…' : 'Fill'}</button>
      </form>
      {err && <p role="alert" className="mt-2 text-[13px] text-bahi">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">{EXAMPLES.map((x) => <button key={x} onClick={() => go(x)} className="rounded-full border border-line-2 px-2.5 py-1 text-[12px] text-ink-2 hover:border-gold">{x}</button>)}</div>
    </div>
  )
}
