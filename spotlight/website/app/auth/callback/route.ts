import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthRedirectPath } from '@/lib/auth-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', origin))
  }

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

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=oauth_error', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Link OAuth user to their employee record
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
    // No employee record — account hasn't been set up by admin yet
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no_account', origin))
  }

  // Link auth_user_id if not already set (first Google login)
  if (!existingEmp.auth_user_id) {
    await admin
      .from('employees')
      .update({ auth_user_id: user.id })
      .eq('id', existingEmp.id)
  }

  const next = getAuthRedirectPath(
    searchParams.get('next'),
    'redirectType' in data && data.redirectType === 'recovery'
  )
  return NextResponse.redirect(new URL(next, origin))
}
