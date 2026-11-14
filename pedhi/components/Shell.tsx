'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { BookOpenText, Boxes, Calculator, Landmark, Building2, ChevronDown, LifeBuoy, Menu, X, History, LogOut, MessageCircle, ReceiptIndianRupee, RotateCcw, Sparkles, Sun, Upload, UserCog, Users } from 'lucide-react'
import { logout, setBranch, setLang } from '@/app/actions'
import { Wordmark } from './Logo'
import { HelpWidget } from './HelpWidget'
import { InstallApp } from './InstallApp'
import { Live } from './Live'
import { ResetDemo } from './ResetDemo'

type Item = { href: string; label: string; icon: typeof Sun; who: string[] }
const NAV: Item[] = [
  { href: '/', label: 'Today', icon: Sun, who: ['owner', 'family', 'manager'] },
  { href: '/bill', label: 'New bill', icon: ReceiptIndianRupee, who: ['owner', 'family', 'manager', 'staff'] },
  { href: '/books', label: 'Books', icon: Landmark, who: ['owner', 'family', 'manager', 'ca'] },
  { href: '/sales', label: 'Sales', icon: BookOpenText, who: ['owner', 'family', 'manager', 'staff', 'ca'] },
  { href: '/inventory', label: 'Stock', icon: Boxes, who: ['owner', 'family', 'manager', 'staff', 'ca'] },
  { href: '/customers', label: 'Udhaar', icon: Users, who: ['owner', 'family', 'manager', 'staff', 'ca'] },
  { href: '/ask', label: 'Ask Pedhi', icon: Sparkles, who: ['owner', 'family', 'manager', 'staff', 'ca'] },
  { href: '/closing', label: 'Day close', icon: Calculator, who: ['owner', 'family', 'manager', 'staff'] },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, who: ['owner', 'family', 'manager', 'staff'] },
  { href: '/team', label: 'People', icon: UserCog, who: ['owner', 'family', 'manager', 'staff', 'ca'] },
  { href: '/import', label: 'Import sheet', icon: Upload, who: ['owner', 'family', 'manager'] },
  { href: '/activity', label: 'Activity', icon: History, who: ['owner', 'family', 'ca'] },
]

export type ShellProps = {
  user: { name: string; role: string; title: string; branch: string | null; org: string; demo: boolean }
  branches: { id: number; name: string }[]; branchId: number | null; lang: 'en' | 'hi'; ai: boolean; children: React.ReactNode
}

export function Shell({ user, branches, branchId, lang, ai, children }: ShellProps) {
  const path = usePathname()
  const [pending, start] = useTransition()
  const [more, setMore] = useState(false)
  useEffect(() => { setMore(false) }, [path])
  const nav = NAV.filter((n) => n.who.includes(user.role))
  // Phone bar: the four places each role goes most; everything else sits under More.
  const PRIMARY: Record<string, string[]> = { staff: ['/bill', '/sales', '/inventory', '/customers'], ca: ['/books', '/sales', '/customers', '/ask'] }
  const primary = (PRIMARY[user.role] ?? ['/', '/bill', '/books', '/customers']).map((h) => nav.find((n) => n.href === h)!).filter(Boolean)
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h))
  const initials = user.name.split(' ').map((p) => p[0]).join('')

  const branchPicker = !user.branch && (
    <label className="relative flex items-center">
      <Building2 className="pointer-events-none absolute left-2.5 hidden size-4 text-muted sm:block" />
      <select aria-label="Branch" value={branchId ?? ''} disabled={pending}
        onChange={(e) => start(() => setBranch(e.target.value ? +e.target.value : null))}
        className="input h-9 w-auto max-w-[min(52vw,190px)] appearance-none pl-3 pr-8 !text-[14px] font-medium sm:max-w-none sm:pl-8">
        <option value="">All branches</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted" />
    </label>
  )
  const langToggle = (
    <div role="group" aria-label="Language" className="flex h-9 shrink-0 rounded-[9px] border border-line-2 bg-card p-0.5 text-[13px] font-semibold">
      {(['en', 'hi'] as const).map((l) => (
        <button key={l} disabled={pending} onClick={() => start(() => setLang(l))} aria-pressed={lang === l}
          className={`rounded-[7px] px-2 transition sm:px-2.5 ${lang === l ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}>{l === 'en' ? 'EN' : 'हिं'}</button>
      ))}
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper-2/60 px-3 py-5 lg:flex">
        <div className="px-2"><Wordmark /></div>
        <p className="mt-1.5 px-2 text-[12.5px] text-muted">{user.org}</p>
        <nav className="mt-6 flex flex-col gap-0.5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[14px] font-medium transition ${active(n.href) ? 'bg-card text-ink shadow-[var(--shadow)] ring-1 ring-line' : 'text-ink-2 hover:bg-card/70 hover:text-ink'}`}>
              <n.icon className={`size-[18px] ${active(n.href) ? 'text-bahi' : 'text-muted'}`} strokeWidth={1.9} />{n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <InstallApp className="px-1" />
          <div className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] text-muted">
            <span className={`size-2 rounded-full ${ai ? 'bg-leaf' : 'bg-gold'}`} />
            {ai ? 'AI connected' : 'Rule engine mode (no AI key)'}
          </div>
          <div className="card flex items-center gap-2.5 p-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-bahi text-[13px] font-semibold text-[#fff6e6]">{initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="block truncate text-[12px] text-muted">{user.title}</span>
            </span>
            <form action={logout}><button className="btn btn-ghost btn-sm px-2" title="Switch person" aria-label="Switch person"><LogOut className="size-4" /></button></form>
          </div>
          {user.role === 'owner' && user.demo && <ResetDemo />}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-paper/85 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
          <div className="shrink-0 lg:hidden"><Wordmark compact /></div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Live />
            {branchPicker}
            {user.branch && <span className="chip chip-gold h-8 px-3 text-[13px]"><Building2 className="size-3.5" />{user.branch}</span>}
            {langToggle}
          </div>
        </header>
        <main className={`mx-auto max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 transition-opacity ${pending ? 'opacity-60' : ''}`}>{children}</main>
      </div>

      <HelpWidget />
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden">
        {primary.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(n.href) ? 'text-bahi' : 'text-muted'}`}>
            <n.icon className="size-5" strokeWidth={1.9} />{n.label}
          </Link>
        ))}
        <button onClick={() => setMore(!more)} aria-expanded={more} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${more ? 'text-bahi' : 'text-muted'}`}>
          {more ? <X className="size-5" strokeWidth={1.9} /> : <Menu className="size-5" strokeWidth={1.9} />}More
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-[45] bg-black/45 lg:hidden" onClick={() => setMore(false)}>
          <div className="card rise absolute inset-x-2 bottom-[72px] p-2" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-1">
              {nav.filter((n) => !primary.includes(n)).map((n) => (
                <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 rounded-[10px] p-3 text-[12.5px] font-medium ${active(n.href) ? 'bg-paper-2 text-bahi' : 'text-ink-2'}`}>
                  <n.icon className="size-5" strokeWidth={1.9} />{n.label}
                </Link>
              ))}
            </div>
            <button onClick={() => { setMore(false); window.dispatchEvent(new Event('pedhi:help')) }}
              className="mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-medium text-ink-2 hover:bg-paper-2">
              <LifeBuoy className="size-5 text-gold" strokeWidth={1.9} />Help: how do I…?</button>
            <InstallApp className="mt-1 px-1" />
            <div className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-muted">{user.name}</span>
              <form action={logout}><button className="btn btn-ghost btn-sm"><LogOut className="size-4" />Switch person</button></form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
