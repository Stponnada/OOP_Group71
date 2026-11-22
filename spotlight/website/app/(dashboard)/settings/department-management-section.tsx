'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDepartment } from './settings-actions'
import { Button, ConfirmDialog, Field, FormMessage, Input, StatusBadge, Table, TBody, THead, Td, Th, Tr } from '@/components/ui'

interface Dept {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

interface Props {
  departments: Dept[]
  orgId: string
}

export default function DepartmentManagementSection({ departments, orgId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; description: string }>({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await addDepartment({ name: form.name.trim(), description: form.description || null, orgId })
      if (!result.ok) setError(result.error)
      else { setForm({ name: '', description: '' }); setSuccess(true); router.refresh() }
    })
  }

  const startEdit = (dept: Dept) => {
    setEditingId(dept.id)
    setEditValues({ name: dept.name, description: dept.description ?? '' })
  }

  // Errors from row actions (inline save, activate), shown under the table.
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const handleSave = async (id: string) => {
    setSaving(true)
    setRowError(null)
    const { error } = await supabase
      .from('departments')
      .update({ name: editValues.name, description: editValues.description || null })
      .eq('id', id)
    setSaving(false)
    if (error) {
      console.error('Failed to update department', error)
      setRowError("Couldn't save this department. Try again.")
      return
    }
    setEditingId(null)
    router.refresh()
  }

  /** Returns true on success. */
  const setActive = async (dept: Dept, active: boolean) => {
    setTogglingId(dept.id)
    const { error } = await supabase.from('departments').update({ is_active: active }).eq('id', dept.id)
    setTogglingId(null)
    if (error) {
      console.error('Failed to update department status', error)
      return false
    }
    router.refresh()
    return true
  }

  // Deactivation goes through a confirmation; reactivation stays one click.
  const [confirmDept, setConfirmDept] = useState<Dept | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const activate = async (dept: Dept) => {
    setRowError(null)
    if (!(await setActive(dept, true))) setRowError(`Couldn't activate ${dept.name}. Try again.`)
  }

  const confirmDeactivate = async () => {
    if (!confirmDept) return
    setConfirmError(null)
    if (await setActive(confirmDept, false)) setConfirmDept(null)
    else setConfirmError("Couldn't deactivate this department. Try again.")
  }

  return (
    <div className="space-y-4">
      {departments.length > 0 && (
        <Table caption="Departments">
          <THead>
            <Th>Department</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {departments.map((dept) => {
              const isEditing = editingId === dept.id
              return (
                <Tr key={dept.id}>
                  <Td>
                    {isEditing ? (
                      <Input
                        aria-label={`Name for ${dept.name}`}
                        value={editValues.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      />
                    ) : dept.name}
                  </Td>
                  <Td muted className="max-w-xs truncate">
                    {isEditing ? (
                      <Input
                        aria-label={`Description for ${dept.name}`}
                        value={editValues.description}
                        onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                        placeholder="Description (optional)"
                      />
                    ) : (dept.description ?? <span className="text-fg-subtle">—</span>)}
                  </Td>
                  <Td>
                    <StatusBadge status={dept.is_active ? 'active' : 'inactive'} />
                  </Td>
                  <Td nowrap>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleSave(dept.id)} pending={saving} pendingLabel="Saving…">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(dept)}>Edit</Button>
                        {dept.is_active ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => { setConfirmError(null); setConfirmDept(dept) }}
                            pending={togglingId === dept.id}
                            pendingLabel="Deactivating…"
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => activate(dept)}
                            pending={togglingId === dept.id}
                            pendingLabel="Activating…"
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}
      {rowError && <FormMessage tone="error">{rowError}</FormMessage>}

      <div className="border-t border-line pt-4">
        <p className="mb-3 text-label font-medium text-fg-muted">Add Department</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Department Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Propulsion Engineering"
              required
            />
          </Field>
          <Field label="Description (optional)">
            <Input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What does this department do?"
            />
          </Field>
          {error && <div className="sm:col-span-2"><FormMessage tone="error">{error}</FormMessage></div>}
          {success && <div className="sm:col-span-2"><FormMessage tone="success">Department added successfully.</FormMessage></div>}
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" pending={isPending} pendingLabel="Adding…">
              Add Department
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDept !== null}
        onCancel={() => setConfirmDept(null)}
        onConfirm={confirmDeactivate}
        pending={confirmDept !== null && togglingId === confirmDept.id}
        title="Deactivate this department?"
        description={confirmDept ? `${confirmDept.name} will be marked inactive. You can reactivate it later.` : undefined}
        confirmLabel="Deactivate"
      >
        {confirmError && <FormMessage tone="error">{confirmError}</FormMessage>}
      </ConfirmDialog>
    </div>
  )
}
