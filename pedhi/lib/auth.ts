// Passwords and the sign-in cookie. Passwords are stored as salted scrypt hashes; the cookie carries
// the user id plus an HMAC, so it can't be edited to become someone else.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { one, run } from './db'

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('hex')}`
}

export function checkPassword(pw: string, stored: string | null | undefined) {
  const [kind, salt, hash] = (stored ?? '').split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const got = scryptSync(pw, salt, 32), want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

// SESSION_SECRET if set; otherwise one random key kept in the database (survives restarts and demo resets).
let cached: string | undefined
async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (cached) return cached
  await run('CREATE TABLE IF NOT EXISTS secrets (k TEXT PRIMARY KEY, v TEXT NOT NULL)')
  await run('INSERT INTO secrets (k, v) VALUES (?, ?) ON CONFLICT (k) DO NOTHING', ['session', randomBytes(32).toString('hex')])
  return (cached = (await one<{ v: string }>('SELECT v FROM secrets WHERE k=?', ['session']))!.v)
}

const mac = (key: string, body: string) => createHmac('sha256', key).update(body).digest('hex')

export async function signSession(userId: number) {
  return `${userId}.${mac(await secret(), String(userId))}`
}

export async function readSession(token: string | undefined) {
  const [id, sig] = (token ?? '').split('.')
  if (!id || !sig) return null
  const want = Buffer.from(mac(await secret(), id)), got = Buffer.from(sig)
  return got.length === want.length && timingSafeEqual(got, want) ? Number(id) : null
}

// shortcut: failed tries are counted in memory per person (5 wrong → 1 minute wait); use a shared store when running several servers.
const fails = new Map<number, { n: number; until: number }>()
export function lockedFor(userId: number) {
  const f = fails.get(userId)
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0
}
export function noteAttempt(userId: number, ok: boolean) {
  if (ok) return void fails.delete(userId)
  const f = fails.get(userId) ?? { n: 0, until: 0 }
  f.n += 1
  if (f.n >= 5) { f.until = Date.now() + 60_000; f.n = 0 }
  fails.set(userId, f)
}
