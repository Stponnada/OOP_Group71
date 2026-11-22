'use client'

import { useCallback, useEffect, useId, useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { inviteEmployee } from './actions'
import { useAssistant } from '@/components/assistant/assistant-context'
import { Button, Field, FormMessage, Input, Modal, Select } from '@/components/ui'

interface Dept {
  id: string
  name: string
}

type Level = 'standard' | 'admin' | 'superuser'
type DeptRow = { departmentId: string; level: Level }

interface Props {
  depts: Dept[]
  isSuperuser: boolean
}

type BaseForm = {
  first_name: string
  last_name: string
  email: string
  designation: string
  employee_code: string
}

const emptyBase: BaseForm = {
  first_name: '',
  last_name: '',
  email: '',
  designation: '',
  employee_code: '',
}

const emptyRow: DeptRow = { departmentId: '', level: 'standard' }

export default function InviteEmployeeButton({ depts, isSuperuser }: Props) {
  const router = useRouter()
  const { registerForm, unregisterForm } = useAssistant()
  const formId = useId()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<BaseForm>(emptyBase)
  const [rows, setRows] = useState<DeptRow[]>([emptyRow])
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [assistantFilled, setAssistantFilled] = useState<Set<keyof BaseForm>>(new Set())

  const applyAssistantPatch = useCallback((patch: Record<string, string>) => {
    const stringFields = new Set(['first_name', 'last_name', 'email', 'designation', 'employee_code'])

    const nextPatch: Partial<BaseForm> = {}
    const changedFields = new Set<keyof BaseForm>()

    for (const [key, value] of Object.entries(patch)) {
      if (stringFields.has(key)) {
        nextPatch[key as keyof BaseForm] = value
        changedFields.add(key as keyof BaseForm)
      }
    }

    // The assistant can only address the first department row — additional
    // departments are added manually.
    setRows((prev) => {
      const next = [...prev]
      if ('department_id' in patch) next[0] = { ...next[0], departmentId: patch.department_id }
      if ('level' in patch && (patch.level === 'standard' || patch.level === 'admin' || (isSuperuser && patch.level === 'superuser'))) {
        next[0] = { ...next[0], level: patch.level as Level }
      }
      return next
    })

    if (changedFields.size === 0) return

    setForm((prev) => ({ ...prev, ...nextPatch }))
    setAssistantFilled(changedFields)
    setError(null)
  }, [isSuperuser])

  useEffect(() => {
    if (!open || tempPassword) {
      unregisterForm('employee_invite')
      return
    }

    registerForm({
      id: 'employee_invite',
      title: 'Create Employee Account',
      fields: [
        { name: 'first_name', label: 'First Name', type: 'text', required: true, value: form.first_name },
        { name: 'last_name', label: 'Last Name', type: 'text', required: true, value: form.last_name },
        { name: 'email', label: 'Email', type: 'email', required: true, value: form.email },
        { name: 'employee_code', label: 'Employee Code', type: 'text', value: form.employee_code },
        { name: 'designation', label: 'Designation', type: 'text', value: form.designation },
        {
          name: 'department_id',
          label: 'Department',
          type: 'select',
          value: rows[0]?.departmentId ?? '',
          options: depts.map((dept) => ({ value: dept.id, label: dept.name })),
        },
        {
          name: 'level',
          label: 'Level',
          type: 'select',
          value: rows[0]?.level ?? 'standard',
          options: [
            { value: 'standard', label: 'Standard' },
            { value: 'admin', label: 'Admin' },
            ...(isSuperuser ? [{ value: 'superuser', label: 'Superuser' }] : []),
          ],
        },
      ],
      applyPatch: applyAssistantPatch,
    })

    return () => unregisterForm('employee_invite')
  }, [applyAssistantPatch, depts, form, isSuperuser, open, registerForm, rows, tempPassword, unregisterForm])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const fieldName = e.target.name as keyof BaseForm
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setAssistantFilled((prev) => {
      const next = new Set(prev)
      next.delete(fieldName)
      return next
    })
  }

  function updateRow(index: number, patch: Partial<DeptRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const departments = rows
        .filter((r) => r.departmentId)
        .map((r) => ({ departmentId: r.departmentId, level: r.level }))
      const result = await inviteEmployee({ ...form, departments })
      if (result.ok) {
        setTempPassword(result.tempPassword)
        setForm(emptyBase)
        setRows([emptyRow])
        setAssistantFilled(new Set())
      } else {
        setError(result.error)
      }
    })
  }

  function handleCopy() {
    if (!tempPassword) return
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    const hadPassword = !!tempPassword
    setOpen(false)
    setTempPassword(null)
    setError(null)
    setCopied(false)
    setForm(emptyBase)
    setRows([emptyRow])
    setAssistantFilled(new Set())
    if (hadPassword) router.refresh()
  }

  // Fields the assistant just filled get a success tint until the user edits them.
  function fieldClass(name: keyof BaseForm) {
    return assistantFilled.has(name) ? 'border-success! bg-success-soft' : ''
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Invite Employee
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        dismissible={!tempPassword}
        title={tempPassword ? 'Account created' : 'Create Employee Account'}
        footer={
          tempPassword ? (
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" pending={isPending} pendingLabel="Creating…">
                Create Account
              </Button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-body text-fg-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
                <Check size={16} aria-hidden="true" />
              </span>
              Share this temporary password with the employee. They&apos;ll be prompted to change it on first login.
            </p>

            <div className="flex items-center justify-between rounded-md border border-line bg-sunken px-4 py-3">
              <span className="font-mono text-body font-medium tracking-wide text-fg">{tempPassword}</span>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="ml-4 shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <p className="text-label text-fg-muted">
              This password is shown only once. Make sure to copy it before closing.
            </p>
          </div>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { name: 'first_name', label: 'First Name', required: true },
                { name: 'last_name', label: 'Last Name', required: true },
              ].map((field) => (
                <Field key={field.name} label={field.label} required={field.required}>
                  <Input
                    type="text"
                    name={field.name}
                    value={form[field.name as keyof BaseForm]}
                    onChange={handleChange}
                    required={field.required}
                    className={fieldClass(field.name as keyof BaseForm)}
                  />
                </Field>
              ))}
            </div>

            {[
              { name: 'email', label: 'Email', required: true, type: 'email' },
              { name: 'employee_code', label: 'Employee Code', required: false, placeholder: 'Leave blank to auto-generate' },
              { name: 'designation', label: 'Designation', required: false },
            ].map((field) => (
              <Field key={field.name} label={field.label} required={field.required}>
                <Input
                  type={field.type ?? 'text'}
                  name={field.name}
                  value={form[field.name as keyof BaseForm]}
                  onChange={handleChange}
                  required={field.required}
                  placeholder={field.placeholder ?? ''}
                  className={fieldClass(field.name as keyof BaseForm)}
                />
              </Field>
            ))}

            <fieldset>
              <legend className="mb-1.5 block text-label font-medium text-fg-muted">Departments</legend>
              <div className="space-y-2">
                {rows.map((row, i) => {
                  const deptName = depts.find((d) => d.id === row.departmentId)?.name
                  const isExecutive = deptName === 'Executive'
                  const usedIds = new Set(rows.filter((_, j) => j !== i).map((r) => r.departmentId).filter(Boolean))
                  return (
                    <div key={i} className="flex gap-2">
                      <Select
                        value={row.departmentId}
                        onChange={(e) => updateRow(i, { departmentId: e.target.value })}
                        required
                        aria-label={rows.length > 1 ? `Department ${i + 1}` : 'Department'}
                        className="flex-1"
                      >
                        <option value="">Select department…</option>
                        {depts
                          .filter((d) => d.id === row.departmentId || !usedIds.has(d.id))
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </Select>
                      {!isExecutive && (
                        <Select
                          value={row.level}
                          onChange={(e) => updateRow(i, { level: e.target.value as Level })}
                          aria-label={rows.length > 1 ? `Level for department ${i + 1}` : 'Level'}
                          className="w-auto"
                        >
                          <option value="standard">Standard</option>
                          <option value="admin">Admin</option>
                          {isSuperuser && <option value="superuser">Superuser</option>}
                        </Select>
                      )}
                      {rows.length > 1 && (
                        <Button
                          variant="ghost"
                          onClick={() => removeRow(i)}
                          aria-label={deptName ? `Remove ${deptName}` : 'Remove department'}
                          className="px-2"
                        >
                          <X size={16} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              {rows.length < depts.length && (
                <Button variant="ghost" size="sm" onClick={addRow} className="mt-2">
                  + Add another department
                </Button>
              )}
            </fieldset>

            <FormMessage tone="error">{error}</FormMessage>
          </form>
        )}
      </Modal>
    </>
  )
}
