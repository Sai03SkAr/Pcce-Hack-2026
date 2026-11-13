import { Download } from 'lucide-react'
import { PrintButton } from './PrintButton'

const field = 'text-[12.5px] font-medium text-ink-2'
const box = 'input mt-1 h-10 sm:h-9 sm:w-auto'

/** A plain GET form so every report is a shareable, printable URL. Children are extra pickers (type, branch). */
export function RangeForm({ from, to, extra, csv, children }: { from?: string; to: string; extra?: Record<string, string>; csv?: string; children?: React.ReactNode }) {
  return (
    <form className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap print:hidden">
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children && <div className="col-span-2 sm:contents">{children}</div>}
      {from !== undefined && <label className={field}>From<input type="date" name="from" defaultValue={from} className={box} /></label>}
      <label className={`${field} ${from === undefined ? 'col-span-2 sm:col-span-1' : ''}`}>{from !== undefined ? 'To' : 'As on'}<input type="date" name="to" defaultValue={to} className={box} /></label>
      <div className="col-span-2 flex gap-2 sm:contents">
        <button className="btn btn-sm h-9 flex-1 sm:flex-none">Show</button>
        <span className="flex gap-2 sm:ml-auto">
          {csv && <a href={csv} className="btn btn-sm h-9"><Download className="size-3.5" />Excel (CSV)</a>}
          <PrintButton />
        </span>
      </div>
    </form>
  )
}
