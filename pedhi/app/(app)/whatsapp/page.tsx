import { thread } from '@/lib/ingest'
import { allUsers, getUser, isFamily } from '@/lib/session'
import { waEnabled } from '@/lib/whatsapp'
import { Simulator } from './Simulator'

const SAMPLES: Record<string, string[]> = {
  owner: ['brief', 'Mapusa mein ACC cement kitna bacha hai?', 'Kiska udhaar sabse zyada baki hai?', 'Aaj kitni sale hui?'],
  family: ['brief', 'Who owes us money?', 'Which branch has the lowest margin this week?'],
  manager: ['5 ultratech cement and 20 sariya 12mm to Bardez on udhaar', 'Lobo paid 20000 by UPI', 'Mapusa stock out?'],
  staff: ['Dhavalikar ko 10 bori ACC cement udhaar', '4 led bulb aur 2 kg nails cash', 'Sawant ne 5000 cash diye', 'undo'],
}

export default async function WhatsApp({ searchParams }: PageProps<'/whatsapp'>) {
  const me = await getUser()
  const sp = await searchParams
  const people = isFamily(me) ? (await allUsers()).filter((u) => u.org_id === me.org_id && u.role !== 'ca') : [me]
  const as = people.find((p) => p.id === Number(sp.as)) ?? (isFamily(me) ? people.find((p) => p.role === 'staff' && p.branch_id === 3) ?? me : me)
  const msgs = await thread(me.org_id, as.id)
  return (
    <Simulator me={{ id: me.id, family: isFamily(me) }} people={people.map((p) => ({ id: p.id, name: p.name, title: p.title, role: p.role, phone: p.phone }))}
      as={{ id: as.id, name: as.name, title: as.title, role: as.role, lang: as.lang }} msgs={msgs} samples={SAMPLES[as.role]} live={waEnabled()} />
  )
}
