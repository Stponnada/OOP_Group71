import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthRedirectPath } from '@/lib/auth-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  let next = getAuthRedirectPath(searchParams.get('next'), type === 'recovery' || type === 'invite')

  if ((token_hash && type) || code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: token_hash! })
    const { error } = result
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
    }

    const isRecovery = type === 'recovery' || type === 'invite' ||
      ('redirectType' in result.data && result.data.redirectType === 'recovery')
    next = getAuthRedirectPath(next, isRecovery)

    // For magic links, link the account to its employee record.
    if (!isRecovery) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=no_account', origin))
      }

      const admin = createAdminClient()
      const { data: existingEmp } = await admin
        .from('employees')
        .select('id, auth_user_id')
        .eq('email', user.email)
        .maybeSingle()

      if (!existingEmp) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=no_account', origin))
      }

      if (!existingEmp.auth_user_id) {
        await admin
          .from('employees')
          .update({ auth_user_id: user.id })
          .eq('id', existingEmp.id)
      }
    }

    return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
}
