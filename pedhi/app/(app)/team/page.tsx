import { allUsers, getUser, isFamily } from '@/lib/session'
import { waEnabled } from '@/lib/whatsapp'
import { PeopleAccess } from './PeopleAccess'

export default async function Team() {
  const me = await getUser()
  const family = isFamily(me)
  const people = (await allUsers()).filter((u) => u.org_id === me.org_id && (family || u.id === me.id))
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-[30px] font-semibold leading-tight">{family ? 'People' : 'My account'}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{family
          ? 'Who can open Pedhi, their password, and the WhatsApp number that lets them bill and ask by message. Only these numbers can talk to Pedhi.'
          : 'Change the password you use to open Pedhi.'}</p>
      </div>
      <PeopleAccess family={family} meId={me.id} waLive={waEnabled()}
        people={people.map((p) => ({ id: p.id, name: p.name, title: p.title, role: p.role, phone: p.phone ?? '' }))} />
    </div>
  )
}
