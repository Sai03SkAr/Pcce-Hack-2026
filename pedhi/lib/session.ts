import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { one, q } from './db'
import { ready } from './seed'
import { readSession } from './auth'
import type { Lang } from './format'
import type { Scope } from './metrics'

export type User = {
  id: number; org_id: number; org: string; branch_id: number | null; branch: string | null
  name: string; role: 'owner' | 'family' | 'manager' | 'staff' | 'ca'; title: string; phone: string; lang: Lang
}

const USER_SQL = `SELECT u.id, u.org_id, u.branch_id, u.name, u.role, u.title, u.phone, u.lang, o.name org, b.name branch FROM users u JOIN orgs o ON o.id=u.org_id LEFT JOIN branches b ON b.id=u.branch_id`
export const userById = (id: number) => one<User>(`${USER_SQL} WHERE u.id=?`, [id])
export const userByPhone = (phone: string) => one<User>(`${USER_SQL} WHERE u.phone=?`, [phone])
export const allUsers = () => q<User>(`${USER_SQL} ORDER BY u.id`)

/** The signed-in person, from the signed cookie set after their password was checked. */
export async function getUser(): Promise<User> {
  await ready()
  const id = await readSession((await cookies()).get('pedhi_uid')?.value)
  const u = id ? await userById(id) : undefined
  if (!u) redirect('/login')
  return u
}

/** Owners and family see every branch (or the one they picked); everyone else is pinned to their own. */
export async function getScope(u: User): Promise<Scope & { branchName: string | null }> {
  if (u.branch_id) return { orgId: u.org_id, branchId: u.branch_id, branchName: u.branch }
  const picked = Number((await cookies()).get('pedhi_branch')?.value) || null
  const b = picked ? await one<{ name: string }>('SELECT name FROM branches WHERE id=? AND org_id=?', [picked, u.org_id]) : undefined
  return { orgId: u.org_id, branchId: b ? picked : null, branchName: b?.name ?? null }
}

export const seesAllBranches = (u: User) => !u.branch_id
/** Cost prices, margins and profit are family business. Counter staff never see them. */
export const seesMoney = (u: User) => u.role !== 'staff'
export const isFamily = (u: User) => u.role === 'owner' || u.role === 'family'
