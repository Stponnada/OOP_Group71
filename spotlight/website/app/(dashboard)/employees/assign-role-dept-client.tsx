'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { assignRole, revokeRole } from './actions'
import { Badge, Button, ConfirmDialog, Field, FormMessage, Modal, Select } from '@/components/ui'

interface Dept { id: string; name: string }
interface EmpRole { role_id: string; roles: { title: string } | null }
type Level = 'standard' | 'admin' | 'superuser'

interface Props {
  employeeId: string
  employeeName: string
  availableDepts: Dept[]
  currentRoles: EmpRole[]
  isSuperuser: boolean
}

export function ManageRolesDeptButton(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Manage access for ${props.employeeName}`}
      >
        Manage Access
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Manage Access — ${props.employeeName}`}
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <ManageBody {...props} />
      </Modal>
    </>
  )
}

/** Rendered only while the modal is open, so its state resets each time it opens. */
function ManageBody({ employeeId, availableDepts, currentRoles, isSuperuser }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<Level>('standard')
  const [confirmRemove, setConfirmRemove] = useState<{ roleId: string; label: string } | null>(null)

  const selectedDeptName = availableDepts.find((d) => d.id === selectedDept)?.name
  const isExecutive = selectedDeptName === 'Executive'

  const addRole = () => {
    if (!selectedDept) return
    setError(null)
    startTransition(async () => {
      const res = await assignRole(employeeId, selectedDept, selectedLevel)
      if (!res.ok) setError(res.error)
      else setSelectedDept('')
    })
  }

  const removeRole = (roleId: string) => {
    setError(null)
    startTransition(async () => {
      const res = await revokeRole(employeeId, roleId)
      if (!res.ok) setError(res.error)
      setConfirmRemove(null)
    })
  }

  return (
    <div className="space-y-4">
      <FormMessage tone="error">{error}</FormMessage>

      <div>
        <h3 className="text-label font-medium text-fg-muted">Current departments &amp; levels</h3>
        <p className="mt-0.5 text-label text-fg-subtle">
          To change someone&apos;s level within a department, remove their current entry and add the new one.
        </p>
        <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
          {currentRoles.length === 0 && (
            <span className="text-body text-fg-muted">No departments assigned</span>
          )}
          {currentRoles.map((er) => {
            const label = er.roles?.title ?? er.role_id
            return (
              <Badge key={er.role_id} tone="neutral">
                <span className="flex items-center gap-1">
                  {label}
                  <button
                    type="button"
                    onClick={() => setConfirmRemove({ roleId: er.role_id, label })}
                    disabled={pending}
                    aria-label={`Remove ${label}`}
                    className="-mr-1 rounded-sm p-0.5 text-fg-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              </Badge>
            )
          })}
        </div>
      </div>

      {availableDepts.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Field label="Department" className="flex-1">
              <Select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="">Department…</option>
                {availableDepts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            {!isExecutive && (
              <Field label="Level">
                <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value as Level)}>
                  <option value="standard">Standard</option>
                  <option value="admin">Admin</option>
                  {isSuperuser && <option value="superuser">Superuser</option>}
                </Select>
              </Field>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={addRole} disabled={pending || !selectedDept}>
            Add
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && removeRole(confirmRemove.roleId)}
        title={`Remove ${confirmRemove?.label ?? 'this role'}?`}
        description="Their access through this department ends immediately."
        confirmLabel="Remove"
        pending={pending}
      />
    </div>
  )
}
