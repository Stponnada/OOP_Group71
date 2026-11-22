'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEmployee } from './actions'
import { Button, Field, FormMessage, Input, Modal, Select } from '@/components/ui'

interface Employee {
  id: string
  first_name: string
  last_name: string
  designation: string | null
  phone: string | null
  location: string | null
  timezone: string | null
  date_of_joining: string | null
  date_of_birth: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

interface Props {
  employee: Employee
}

const TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
]

export default function EditEmployeeModal({ employee }: Props) {
  const router = useRouter()
  const formId = useId()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: employee.first_name ?? '',
    last_name: employee.last_name ?? '',
    designation: employee.designation ?? '',
    phone: employee.phone ?? '',
    location: employee.location ?? '',
    timezone: employee.timezone ?? 'Asia/Kolkata',
    date_of_joining: employee.date_of_joining ? employee.date_of_joining.slice(0, 10) : '',
    date_of_birth: employee.date_of_birth ? employee.date_of_birth.slice(0, 10) : '',
    emergency_contact_name: employee.emergency_contact_name ?? '',
    emergency_contact_phone: employee.emergency_contact_phone ?? '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateEmployee({
        id: employee.id,
        first_name: form.first_name,
        last_name: form.last_name,
        designation: form.designation || null,
        phone: form.phone || null,
        location: form.location || null,
        timezone: form.timezone || null,
        date_of_joining: form.date_of_joining || null,
        date_of_birth: form.date_of_birth || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      })
      if (!result.ok) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  const name = `${employee.first_name} ${employee.last_name}`.trim()

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={name ? `Edit ${name}` : undefined}>
        Edit
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Employee"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="primary" pending={isPending} pendingLabel="Saving…">
              Save Changes
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First Name" required>
              <Input name="first_name" value={form.first_name} onChange={handleChange} required />
            </Field>
            <Field label="Last Name" required>
              <Input name="last_name" value={form.last_name} onChange={handleChange} required />
            </Field>
          </div>

          <Field label="Designation">
            <Input
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="e.g. Software Engineer"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone">
              <Input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Location">
              <Input name="location" value={form.location} onChange={handleChange} placeholder="Hyderabad, India" />
            </Field>
          </div>

          <Field label="Timezone">
            <Select name="timezone" value={form.timezone} onChange={handleChange}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date of Joining">
              <Input type="date" name="date_of_joining" value={form.date_of_joining} onChange={handleChange} />
            </Field>
            <Field label="Date of Birth">
              <Input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Emergency Contact">
              <Input
                name="emergency_contact_name"
                value={form.emergency_contact_name}
                onChange={handleChange}
                placeholder="Contact name"
              />
            </Field>
            <Field label="Emergency Phone">
              <Input
                name="emergency_contact_phone"
                value={form.emergency_contact_phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
              />
            </Field>
          </div>

          <FormMessage tone="error">{error}</FormMessage>
        </form>
      </Modal>
    </>
  )
}
