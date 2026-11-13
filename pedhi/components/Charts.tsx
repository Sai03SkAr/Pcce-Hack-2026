'use client'
import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { BRANCH_COLORS as COLORS } from './colors'
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (d: string) => `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`
const short = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}k` : `₹${n}`)
const full = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div className="card px-3 py-2 text-[12.5px] shadow-[var(--shadow-lg)]">
      <div className="mb-1 font-semibold">{day(label)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 num">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-ink-2">{p.dataKey}</span><span className="ml-auto pl-4 font-medium">{full(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && <div className="mt-1 flex border-t border-line pt-1 font-semibold num"><span>Total</span><span className="ml-auto">{full(total)}</span></div>}
    </div>
  )
}

/** Daily revenue, stacked by branch. */
export function SalesChart({ data, keys }: { data: any[]; keys: string[] }) {
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Daily sales for the last 30 days, by branch">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="day" tickFormatter={day} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--paper-2)' }} />
          {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i % 4]} radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Spark({ data, color = 'var(--bahi)' }: { data: { day: string; revenue: number }[]; color?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.22} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="revenue" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

