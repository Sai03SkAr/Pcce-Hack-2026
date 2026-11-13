import { connection } from 'next/server'
import { allUsers } from '@/lib/session'
import { ready } from '@/lib/seed'
import { login } from '../actions'
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
          <p className="mt-2 text-muted">Each person sees a different business. Pick one to try it.</p>
          <ul className="mt-7 space-y-2.5">
            {users.map((u, i) => (
              <li key={u.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
                <form action={login.bind(null, u.id)}>
                  <button className="card group flex w-full items-center gap-3.5 p-3.5 text-left transition hover:border-line-2 hover:shadow-[var(--shadow-lg)]">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${TONE[u.role]}`}>
                      {u.name.split(' ').slice(-2).map((p) => p[0]).join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="font-semibold">{u.name}</span><span className="chip chip-grey">{u.role === 'ca' ? 'CA' : u.role[0].toUpperCase() + u.role.slice(1)}</span></span>
                      <span className="block text-[13px] text-ink-2">{u.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{SEES[u.role]}</span>
                    </span>
                    <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-bahi">→</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
