import { notFound } from 'next/navigation'
import { loadAuthority, LETTERS_METHOD } from '@/lib/loadAuthority'
import { authorityTypePrefix } from '@/lib/getMayorForYear'
import AuthorityProfile from './AuthorityProfile'

// The authority page in letter grades: the authority first, its heads second.
// Replaced /mayor/[slug] when the site switched to letters (2026-11-01).

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const data = await loadAuthority(slug, LETTERS_METHOD)
  if (!data) return { title: 'Munimark' }
  const { authority } = data
  return {
    title: `${authorityTypePrefix(authority.authority_type)} ${authority.name_display} | Munimark`,
  }
}

export default async function AuthorityPage({ params }: Props) {
  const { slug } = await params
  const data = await loadAuthority(slug, LETTERS_METHOD)
  if (!data) notFound()
  return <AuthorityProfile {...data} />
}
