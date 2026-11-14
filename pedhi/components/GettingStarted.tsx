import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

type Step = { done: boolean; href: string; en: string; hi: string; hintEn: string; hintHi: string }

/** First-day checklist for a business that has just been set up. Disappears after the first bill. */
export function GettingStarted({ steps, lang }: { steps: Step[]; lang: 'en' | 'hi' }) {
  const t = (en: string, hi: string) => (lang === 'hi' ? hi : en)
  const left = steps.filter((s) => !s.done).length
  return (
    <section className="card rise p-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="display text-[22px] font-semibold">{t('Set up your pedhi', 'Apni pedhi taiyaar karo')}</h2>
        <span className="text-[13px] text-muted">{steps.length - left} {t('of', 'mein se')} {steps.length} {t('done', 'ho gaye')}</span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i}>
            <Link href={s.href} className={`flex h-full items-start gap-3 rounded-[12px] border p-3 transition ${s.done ? 'border-line bg-paper-2/60' : 'border-line-2 hover:border-bahi'}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${s.done ? 'bg-leaf-soft text-leaf' : 'bg-bahi text-[#fff6e6]'}`}>{s.done ? <Check className="size-4" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-semibold ${s.done ? 'text-muted line-through' : ''}`}>{t(s.en, s.hi)}</span>
                <span className="block text-[12.5px] text-muted">{t(s.hintEn, s.hintHi)}</span>
              </span>
              {!s.done && <ArrowRight className="mt-1 size-4 shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
