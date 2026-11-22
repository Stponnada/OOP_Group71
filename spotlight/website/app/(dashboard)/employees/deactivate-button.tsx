'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button, ConfirmDialog, FormMessage } from '@/components/ui'

interface Props {
  employeeId: string
  employeeName: string
}

export default function DeactivateButton({ employeeId, employeeName }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = async () => {
    setLoading(true)
    setError(null)
    // select('id') so an RLS-filtered update (0 rows, no error) is detected as a failure too.
    const { data, error: updateError } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', employeeId)
      .select('id')
    setLoading(false)
    if (updateError || !data || data.length === 0) {
      console.error('Deactivate employee failed:', updateError?.message ?? 'no rows updated')
      setError(`Couldn't deactivate ${employeeName}. Try again.`)
      return
    }
    setConfirming(false)
    router.refresh()
  }

  const closeConfirm = () => {
    setConfirming(false)
    setError(null)
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)} aria-label={`Deactivate ${employeeName}`}>
        Deactivate
      </Button>
      <ConfirmDialog
        open={confirming}
        onCancel={closeConfirm}
        onConfirm={handleDeactivate}
        title={`Deactivate ${employeeName}?`}
        description="They will be marked inactive."
        confirmLabel="Deactivate"
        pending={loading}
      >
        <FormMessage tone="error">{error}</FormMessage>
      </ConfirmDialog>
    </>
  )
}
