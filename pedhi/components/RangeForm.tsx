import { Download } from 'lucide-react'
import { PrintButton } from './PrintButton'

/** A plain GET form so every report is a shareable, printable URL. */
export function RangeForm({ from, to, extra, csv, children }: { from?: string; to: string; extra?: Record<string, string>; csv?: string; children?: React.ReactNode }) {
  return (
    <form className="flex flex-wrap items-end gap-2 print:hidden">
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {from !== undefined && <label className="text-[12.5px] font-medium text-ink-2">From<input type="date" name="from" defaultValue={from} className="input mt-1 h-9 w-auto" /></label>}
      <label className="text-[12.5px] font-medium text-ink-2">{from !== undefined ? 'To' : 'As on'}<input type="date" name="to" defaultValue={to} className="input mt-1 h-9 w-auto" /></label>
      <button className="btn btn-sm h-9">Show</button>
      <span className="ml-auto flex gap-2">
        {csv && <a href={csv} className="btn btn-sm h-9"><Download className="size-3.5" />Excel (CSV)</a>}
        <PrintButton />
      </span>
    </form>
  )
}
