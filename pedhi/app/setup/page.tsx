import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ready } from '@/lib/seed'
import { BUSINESS_TYPES, STATES } from '@/lib/onboard'
import { SetupWizard } from './SetupWizard'

export const metadata: Metadata = { title: 'Set up your business · Pedhi' }

export default async function Setup() {
  await connection()
  await ready()
  return <SetupWizard states={STATES} types={BUSINESS_TYPES.map((t) => ({ id: t.id, label: t.label, hint: t.hint, expiry: t.expiry, items: t.items.map((i) => i[0]) }))} />
}
