import { SUGGESTIONS } from '@/lib/chat'
import { aiEnabled } from '@/lib/llm'
import { getUser } from '@/lib/session'
import { getLang } from '../../actions'
import { AskChat } from './AskChat'

export default async function Ask() {
  const u = await getUser()
  const lang = await getLang()
  return <AskChat name={u.name.split(' ')[0]} suggestions={SUGGESTIONS[lang]} ai={aiEnabled()} lang={lang} />
}
