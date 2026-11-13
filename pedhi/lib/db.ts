import { createClient, type Client, type InValue, type Transaction } from '@libsql/client'
import path from 'node:path'

// Local file by default; point DATABASE_URL at a hosted libSQL/Turso database to deploy.
const g = globalThis as unknown as { __pedhiDb?: Client }
export const db: Client = (g.__pedhiDb ??= createClient({
  url: process.env.DATABASE_URL ?? 'file:' + path.join(process.cwd(), 'pedhi.db'),
  authToken: process.env.DATABASE_AUTH_TOKEN,
}))

export type Row = Record<string, any>
type Exec = Pick<Client, 'execute'> | Transaction

// libSQL rows are array-like; copy to plain objects so they can cross into client components.
export async function q<T = Row>(sql: string, args: InValue[] = [], on: Exec = db): Promise<T[]> {
  const r = await on.execute({ sql, args })
  return r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) as T[]
}
export const one = async <T = Row>(sql: string, args: InValue[] = [], on: Exec = db) =>
  (await q<T>(sql, args, on))[0] as T | undefined
export async function run(sql: string, args: InValue[] = [], on: Exec = db) {
  const r = await on.execute({ sql, args })
  return Number(r.lastInsertRowid ?? 0)
}

// SQLite takes one writer at a time, so write transactions queue up in-process instead of failing as busy.
const lock = globalThis as unknown as { __pedhiTx?: Promise<unknown> }
export function tx<T>(fn: (t: Transaction) => Promise<T>): Promise<T> {
  const p = (lock.__pedhiTx ?? Promise.resolve()).catch(() => {}).then(() => inTx(fn))
  lock.__pedhiTx = p
  return p
}
async function inTx<T>(fn: (t: Transaction) => Promise<T>): Promise<T> {
  const t = await db.transaction('write')
  try {
    const out = await fn(t)
    await t.commit()
    return out
  } catch (e) {
    await t.rollback()
    throw e
  }
}
