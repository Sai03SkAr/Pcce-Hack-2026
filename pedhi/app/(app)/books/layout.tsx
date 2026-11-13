import { redirect } from 'next/navigation'
import { getUser } from '@/lib/session'
import { BooksTabs } from '@/components/BooksTabs'

export default async function BooksLayout({ children }: LayoutProps<'/books'>) {
  const u = await getUser()
  if (u.role === 'staff') redirect('/bill')
  return <><BooksTabs />{children}</>
}
