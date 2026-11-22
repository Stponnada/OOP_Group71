'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEmployee } from './actions'
import { Button, Field, FormMessage, Input, Modal } from '@/components/ui'

interface Props {
  employeeId: string
  employeeName: string
}

export default function DeleteButton({ employeeId, employeeName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const result = await deleteEmployee(employeeId)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setConfirming(false)
    router.refresh()
  }

  const handleCancel = () => {
    setConfirming(false)
    setConfirmText('')
    setError(null)
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)} aria-label={`Delete ${employeeName}`}>
        Delete
      </Button>
      {/* A type-to-confirm dialog: stronger than ConfirmDialog, since this permanently deletes. */}
      <Modal
        open={confirming}
        onClose={handleCancel}
        title={`Delete ${employeeName}?`}
        description="This permanently deletes the employee. It can't be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              solid
              onClick={handleDelete}
              disabled={confirmText !== employeeName}
              pending={loading}
              pendingLabel="Deleting…"
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label={
              <>
                Type <span className="font-mono font-medium text-fg">{employeeName}</span> to permanently delete
              </>
            }
          >
            <Input autoFocus autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      </Modal>
    </>
  )
}
