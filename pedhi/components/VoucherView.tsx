import { fmtDay, inr } from '@/lib/format'

type Line = { ledger_id: number; name: string; grp: string; amount: number }
export type VoucherRow = { id: number; type: string; number: string; day: string; narration: string; party?: string | null; lines: Line[]; amount: number }

const TYPE_TONE: Record<string, string> = { Sales: 'chip-green', Receipt: 'chip-green', Purchase: 'chip-gold', Payment: 'chip-red', Contra: 'chip-grey', Journal: 'chip-grey', 'Credit Note': 'chip-amber', 'Debit Note': 'chip-amber' }

/** The same entry, the way Tally (and the CA) sees it: debit and credit lines that balance. */
export function VoucherView({ v, compact }: { v: VoucherRow; compact?: boolean }) {
  const dr = v.lines.filter((l) => l.amount > 0), cr = v.lines.filter((l) => l.amount < 0)
  return (
    <div className={compact ? '' : 'card p-4'}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`chip ${TYPE_TONE[v.type] ?? 'chip-grey'}`}>{v.type} voucher</span>
          <span className="num text-[13px] font-semibold">{v.number}</span>
          <span className="text-[13px] text-muted">{fmtDay(v.day)}</span>
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="pb-1 font-semibold">Ledger</th><th className="pb-1 font-semibold">Under (Tally group)</th><th className="pb-1 text-right font-semibold">Debit</th><th className="pb-1 text-right font-semibold">Credit</th></tr></thead>
        <tbody className="num">
          {[...dr, ...cr].map((l) => (
            <tr key={l.ledger_id} className="border-t border-line">
              <td className={`py-1.5 ${l.amount < 0 ? 'pl-5' : ''}`}>{l.amount > 0 ? 'Dr ' : 'To '}{l.name}</td>
              <td className="py-1.5 text-muted">{l.grp}</td>
              <td className="py-1.5 text-right">{l.amount > 0 ? inr(l.amount) : ''}</td>
              <td className="py-1.5 text-right">{l.amount < 0 ? inr(-l.amount) : ''}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-line-2 font-semibold"><td className="pt-1.5" colSpan={2}>Total</td><td className="pt-1.5 text-right">{inr(v.amount)}</td><td className="pt-1.5 text-right">{inr(v.amount)}</td></tr>
        </tbody>
      </table>
      {!compact && <p className="mt-2 text-[12.5px] text-muted">Narration: {v.narration}</p>}
    </div>
  )
}
