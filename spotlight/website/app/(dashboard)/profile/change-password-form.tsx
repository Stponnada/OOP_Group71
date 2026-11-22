'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, FormMessage, Input, Panel } from '@/components/ui'

export default function ChangePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setStatus('error')
      setMessage('Password must be at least 8 characters.')
      return
    }

    setStatus('loading')
    setMessage(null)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('success')
      setMessage('Password updated successfully.')
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <Panel title="Change Password" description="Update your account password.">
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <Field label="New Password">
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
          />
        </Field>
        <Field label="Confirm Password">
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {message && (
          <FormMessage tone={status === 'success' ? 'success' : 'error'}>{message}</FormMessage>
        )}

        <Button type="submit" variant="primary" pending={status === 'loading'} pendingLabel="Updating…">
          Update Password
        </Button>
      </form>
    </Panel>
  )
}
