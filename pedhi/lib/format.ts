// All business dates are IST calendar days stored as 'YYYY-MM-DD' text.
const IST = 5.5 * 3600e3

export const today = () => new Date(Date.now() + IST).toISOString().slice(0, 10)
export const nowTs = () => new Date(Date.now() + IST).toISOString().slice(0, 19).replace('T', ' ')

export function addDays(day: string, n: number) {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5)
export const weekday = (day: string) => new Date(day + 'T00:00:00Z').getUTCDay()

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = (day: string) => `${+day.slice(8)} ${MON[+day.slice(5, 7) - 1]}`
export const fmtDayLong = (day: string) => `${WD[weekday(day)]}, ${fmtDay(day)}`
export const weekdayName = (day: string) => WD_LONG[weekday(day)]

export const inr = (n: number) => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(n || 0)).toLocaleString('en-IN')
export function inrShort(n: number) {
  const a = Math.abs(n || 0)
  const s = n < 0 ? '-' : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`
  return `${s}₹${Math.round(a)}`
}
export const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`

export type Lang = 'en' | 'hi'
export const L = (lang: Lang, en: string, hi: string) => (lang === 'hi' ? hi : en)
