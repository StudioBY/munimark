import { notFound } from 'next/navigation'
import { loadAuthority } from '@/lib/loadAuthority'
import { authorityTypePrefix } from '@/lib/getMayorForYear'
import AuthorityProfile from './AuthorityProfile'

// Draft v2 of the authority page: the authority first, its heads second.
// Lives beside /mayor/[slug] so the two can be compared before one replaces
// the other. Not linked from anywhere and not in the sitemap.

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const data = await loadAuthority(slug)
  if (!data) return { title: 'Munimark' }
  const { authority } = data
  return {
    title: `${authorityTypePrefix(authority.authority_type)} ${authority.name_display} | Munimark`,
    robots: { index: false, follow: false },
  }
}

export default async function AuthorityPage({ params }: Props) {
  const { slug } = await params
  const data = await loadAuthority(slug)
  if (!data) notFound()
  return <AuthorityProfile {...data} />
}
