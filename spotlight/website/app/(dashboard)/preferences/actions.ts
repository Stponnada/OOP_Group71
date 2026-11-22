'use server'

import { createClient } from '@/lib/supabase/server'

/** Saves the signed-in person's preferences on their account (auth user metadata). */
export async function savePreferences(prefs: { hideMascot: boolean }): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { hide_mascot: prefs.hideMascot === true } })
  if (error) console.error('savePreferences failed:', error.message)
}
