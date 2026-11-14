import { allUsers, getUser, isFamily } from '@/lib/session'
import { waEnabled } from '@/lib/whatsapp'
import { headers } from 'next/headers'
import { PeopleAccess } from './PeopleAccess'
import { WhatsAppSetup } from './WhatsAppSetup'
import { AddPerson } from './AddPerson'
import { q } from '@/lib/db'

export default async function Team() {
  const me = await getUser()
  const family = isFamily(me)
  const h = await headers()
  const base = process.env.PUBLIC_URL || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`
  const env = (k: string) => !!process.env[k]
  const steps = [
    { label: 'Access token', ok: env('WHATSAPP_TOKEN'), hint: 'WHATSAPP_TOKEN in pedhi/.env.local, from Meta → WhatsApp → API Setup → Generate access token' },
    { label: 'Phone number ID', ok: env('WHATSAPP_PHONE_NUMBER_ID'), hint: 'WHATSAPP_PHONE_NUMBER_ID, shown under the test number on API Setup' },
    { label: 'App secret', ok: env('WHATSAPP_APP_SECRET'), hint: 'WHATSAPP_APP_SECRET, from App settings → Basic. Pedhi uses it to reject fake messages' },
    { label: 'Verify token', ok: env('WHATSAPP_VERIFY_TOKEN'), hint: 'Already generated in .env.local' },
    { label: 'https link', ok: base.startsWith('https://'), hint: 'Meta only calls https. Open Pedhi through the tunnel link to see the right callback URL' },
  ]
  const people = (await allUsers()).filter((u) => u.org_id === me.org_id && (family || u.id === me.id))
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-[30px] font-semibold leading-tight">{family ? 'People' : 'My account'}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{family
          ? 'Who can open Pedhi, their password, and the WhatsApp number that lets them bill and ask by message. Only these numbers can talk to Pedhi.'
          : 'Change the password you use to open Pedhi.'}</p>
      </div>
      {me.role === 'owner' && <WhatsAppSetup steps={steps} callback={`${base}/api/whatsapp`} verify={process.env.WHATSAPP_VERIFY_TOKEN ?? ''} />}
      {family && <AddPerson branches={await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [me.org_id])} />}
      <PeopleAccess family={family} meId={me.id} waLive={waEnabled()}
        people={people.map((p) => ({ id: p.id, name: p.name, title: p.title, role: p.role, phone: p.phone ?? '' }))} />
    </div>
  )
}
