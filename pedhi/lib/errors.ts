import type { Transaction } from '@libsql/client'
import { run } from './db'
import { nowTs } from './format'

/** A business-rule refusal whose message is shown to the user as is. */
export class OpError extends Error {}

export const audit = (u: { id: number } | null, orgId: number, action: string, detail: string, t?: Transaction) =>
  run('INSERT INTO audit (org_id, user_id, ts, action, detail) VALUES (?,?,?,?,?)', [orgId, u?.id ?? null, nowTs(), action, detail], t)
