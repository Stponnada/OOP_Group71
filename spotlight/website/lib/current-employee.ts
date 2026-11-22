import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Every dashboard layout render and every page render used to independently
// re-verify the session and re-query the employees table — two full
// round-trips to Supabase, duplicated on top of what the layout had already
// just done a moment earlier in the same request. Wrapping it in React's
// cache() means the *first* call in a request pays the cost and every
// subsequent call (layout, then the page, then any nested component) gets
// the memoized result for free. Uses getUser() (server-verified), matching
// what the layout already did — not getSession() (client-trusted only).
export const getCurrentEmployee = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, employee: null }

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return { supabase, user, employee }
})

// Convenience for the common case: bail to /login if there's no session or
// no matching employee row, otherwise hand back the client + employee.
export async function requireEmployee() {
  const { supabase, employee } = await getCurrentEmployee()
  if (!employee) redirect('/login')
  return { supabase, employee }
}
