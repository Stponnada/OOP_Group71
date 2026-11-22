import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string; code?: string }>
}) {
  const params = await searchParams

  // PKCE flow — Supabase password-reset / invite emails land here with ?token_hash=
  if (params.token_hash && params.type) {
    const query = new URLSearchParams({ token_hash: params.token_hash, type: params.type })
    if (params.next) query.set('next', params.next)
    redirect(`/auth/confirm?${query}`)
  }

  if (params.code) {
    const query = new URLSearchParams({ code: params.code })
    if (params.next) query.set('next', params.next)
    redirect(`/auth/callback?${query}`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/login')
}
