import { connection } from 'next/server'
import { allUsers } from '@/lib/session'
import { ready } from '@/lib/seed'
import { PeoplePicker } from './PeoplePicker'
import { Wordmark } from '@/components/Logo'

const SEES: Record<string, string> = {
  owner: 'Every branch, profit, the morning brief on WhatsApp',
  family: 'Every branch, finance, udhaar and reminders',
  manager: 'One branch: stock, bills, transfers',
  staff: 'Billing only. No cost prices, no profit',
  ca: 'Read-only books, GST, Tally export, sign-off',
}
const TONE: Record<string, string> = { owner: 'bg-bahi text-[#fff6e6]', family: 'bg-gold text-[#fff6e6]', manager: 'bg-leaf text-white', staff: 'bg-paper-2 text-ink-2', ca: 'bg-ink text-paper' }

export default async function Login() {
  await connection() // the people list comes from the database on every request
  await ready()
  const users = await allUsers()
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-bahi p-12 text-[#fff6e6]">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, #fff 31px 32px)' }} />
        <div className="absolute left-12 top-0 bottom-0 w-px bg-[#e7c27a]/60" />
        <div className="relative pl-8"><span className="display text-2xl">पेढी · Pedhi</span></div>
        <div className="relative pl-8 max-w-lg">
          <p className="display text-[44px] leading-[1.05] font-semibold">Your business already runs on WhatsApp.<br /><span className="text-[#e7c27a]">Now it answers back.</span></p>
          <p className="mt-6 text-[17px] leading-relaxed text-[#fff6e6]/80">Pedhi is the AI munim for family businesses. Staff keep billing the way they do today. Every morning the owner gets one message: what happened, what is wrong, and what to do about it, across every branch.</p>
        </div>
        <p className="relative pl-8 text-sm text-[#fff6e6]/60">Demo business: Naik Traders, hardware and building materials · Margao, Mapusa, Ponda</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden mb-8"><Wordmark /></div>
          <h1 className="display text-3xl font-semibold">Who is opening the pedhi?</h1>
          <p className="mt-2 text-muted">Each person sees a different business. Tap your name and enter your password.</p>
          <PeoplePicker people={users.map((u) => ({ id: u.id, name: u.name, role: u.role, title: u.title, sees: SEES[u.role], tone: TONE[u.role] }))} />
          <p className="mt-6 text-[12.5px] text-muted">Each person has their own password. The family can change any password under People.</p>
        </div>
      </section>
    </main>
  )
}
