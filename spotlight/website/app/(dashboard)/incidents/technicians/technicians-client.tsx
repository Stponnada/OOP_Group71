'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FormMessage,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui'
import type { Service, Skill, Technician, TechnicianUpdate } from '@/lib/itsm-types'
import { removeTechnicianProfile, saveTechnicianProfile } from '../actions'

type Employee = { id: string; name: string; email: string }

const LEVELS = ['None', 'Basic', 'Working', 'Solid', 'Strong', 'Expert']

export default function TechniciansClient({
  technicians,
  skills,
  services,
  employees,
}: {
  technicians: Technician[]
  skills: Skill[]
  services: Service[]
  employees: Employee[]
}) {
  const [editing, setEditing] = useState<{ employeeId: string; name: string; current?: Technician } | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Technician | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const serviceName = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services])
  const onRoster = new Set(technicians.map((t) => t.employeeId))
  const candidates = employees.filter((e) => !onRoster.has(e.id))

  function toggleAvailability(t: Technician) {
    setError(null)
    start(async () => {
      const res = await saveTechnicianProfile(t.employeeId!, { isAvailable: !t.isAvailable, teamLeadId: t.teamLeadId ?? null })
      if ('error' in res) setError(res.error)
    })
  }

  function remove() {
    if (!removing) return
    setError(null)
    start(async () => {
      const res = await removeTechnicianProfile(removing.employeeId!)
      if ('error' in res) setError(res.error)
      setRemoving(null)
    })
  }

  return (
    <>
      <PageHeader
        title="Technicians"
        subtitle="Who takes incidents, what they know and how much they can carry. Assignment reads this roster."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} disabled={candidates.length === 0}>
            Add technician
          </Button>
        }
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}

      <Panel count={technicians.length}>
        {technicians.length === 0 ? (
          <EmptyState title="Nobody is on the roster" description="Add the people who should be assigned incidents." />
        ) : (
          <Table caption="Technicians" minWidth={860}>
            <THead>
              <Th>Technician</Th>
              <Th>Status</Th>
              <Th>Load</Th>
              <Th>Skills</Th>
              <Th>Services</Th>
              <Th>Team lead</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <TBody>
              {technicians.map((t) => {
                const full = (t.activeIncidents ?? 0) >= (t.maxActiveIncidents ?? Infinity)
                const top = [...(t.skills ?? [])].sort((a, b) => (b.proficiency ?? 0) - (a.proficiency ?? 0)).slice(0, 3)
                return (
                  <Tr key={t.employeeId}>
                    <Td>
                      <p className="font-medium text-fg">{t.displayName}</p>
                      <p className="text-label text-fg-muted">{t.experienceYears ?? 0} years’ experience</p>
                    </Td>
                    <Td>
                      <Badge tone={t.isAvailable ? 'positive' : 'neutral'}>{t.isAvailable ? 'Available' : 'Away'}</Badge>
                    </Td>
                    <Td nowrap>
                      <span className={full ? 'font-medium text-danger' : 'text-fg'}>
                        {t.activeIncidents ?? 0} of {t.maxActiveIncidents ?? '—'}
                      </span>
                    </Td>
                    <Td muted>{top.length ? top.map((s) => `${s.name} (${s.proficiency})`).join(', ') : '—'}</Td>
                    <Td muted>
                      {(t.serviceIds ?? []).length
                        ? (t.serviceIds ?? []).map((id) => serviceName.get(id)).filter(Boolean).join(', ')
                        : 'Any'}
                    </Td>
                    <Td muted>{t.teamLeadName ?? '—'}</Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggleAvailability(t)}>
                          {t.isAvailable ? 'Mark away' : 'Mark available'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ employeeId: t.employeeId!, name: t.displayName ?? '', current: t })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(t)}>
                          Remove
                        </Button>
                      </span>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </Panel>

      <AddModal
        open={adding}
        candidates={candidates}
        onClose={() => setAdding(false)}
        onPick={(e) => {
          setAdding(false)
          setEditing({ employeeId: e.id, name: e.name })
        }}
      />

      {editing && (
        <EditModal
          key={editing.employeeId}
          employeeId={editing.employeeId}
          name={editing.name}
          current={editing.current}
          skills={skills}
          services={services}
          leads={[
            ...technicians.filter((t) => t.employeeId !== editing.employeeId).map((t) => ({ id: t.employeeId!, name: t.displayName ?? '' })),
            ...employees.filter((e) => e.id !== editing.employeeId && !onRoster.has(e.id)),
          ]}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        title={`Take ${removing?.displayName} off the roster?`}
        description="They stop receiving incidents. Anyone still holding open incidents has to hand them over first."
        confirmLabel="Remove"
        danger
        pending={pending}
      />
    </>
  )
}

function AddModal({
  open,
  candidates,
  onClose,
  onPick,
}: {
  open: boolean
  candidates: Employee[]
  onClose: () => void
  onPick: (e: Employee) => void
}) {
  const [q, setQ] = useState('')
  const shown = candidates.filter((e) => `${e.name} ${e.email}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30)
  return (
    <Modal open={open} onClose={onClose} title="Add a technician" description="Pick the employee. You set their skills and limits next.">
      <Field label="Search employees">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" autoFocus />
      </Field>
      <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
        {shown.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="font-medium text-fg">{e.name}</span>
              <span className="text-label text-fg-muted">{e.email}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="py-3 text-label text-fg-muted">No one else to add.</li>}
      </ul>
    </Modal>
  )
}

function EditModal({
  employeeId,
  name,
  current,
  skills,
  services,
  leads,
  onClose,
}: {
  employeeId: string
  name: string
  current?: Technician
  skills: Skill[]
  services: Service[]
  leads: { id: string; name: string }[]
  onClose: () => void
}) {
  const [available, setAvailable] = useState(current?.isAvailable ?? true)
  const [max, setMax] = useState(String(current?.maxActiveIncidents ?? 5))
  const [years, setYears] = useState(String(current?.experienceYears ?? 0))
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries((current?.skills ?? []).map((s) => [s.skillId!, s.proficiency ?? 0])),
  )
  const [serviceIds, setServiceIds] = useState<string[]>(current?.serviceIds ?? [])
  const [lead, setLead] = useState(current?.teamLeadId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    const maxN = Number(max)
    const yearsN = Number(years)
    if (!Number.isInteger(maxN) || maxN < 1 || maxN > 50) return setError('The limit is a whole number from 1 to 50.')
    if (!Number.isInteger(yearsN) || yearsN < 0 || yearsN > 60) return setError('Experience is a whole number of years.')
    const body: TechnicianUpdate = {
      isAvailable: available,
      maxActiveIncidents: maxN,
      experienceYears: yearsN,
      skills: Object.entries(levels)
        .filter(([, p]) => p > 0)
        .map(([skillId, proficiency]) => ({ skillId, proficiency })),
      serviceIds,
      teamLeadId: lead || null,
    }
    setError(null)
    start(async () => {
      const res = await saveTechnicianProfile(employeeId, body)
      if ('error' in res) setError(res.error)
      else onClose()
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={current ? `Edit ${name}` : `Add ${name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={pending} pendingLabel="Saving…" onClick={save}>
            {current ? 'Save changes' : 'Add to roster'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Open incidents at most" hint="Auto-assignment stops here.">
            <Input type="number" min={1} max={50} value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
          <Field label="Years of experience">
            <Input type="number" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <Field label="Team lead" hint="First to hear when their incidents slip.">
            <Select value={lead} onChange={(e) => setLead(e.target.value)}>
              <option value="">None</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-body text-fg">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4 accent-action" />
          Available for new incidents
        </label>

        <fieldset>
          <legend className="text-label font-medium text-fg-muted">Skills</legend>
          <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {skills.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-3 text-body text-fg">
                {s.name}
                <Select
                  className="w-32"
                  value={String(levels[s.id!] ?? 0)}
                  onChange={(e) => setLevels((l) => ({ ...l, [s.id!]: Number(e.target.value) }))}
                >
                  {LEVELS.map((label, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? label : `${n} · ${label}`}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-label font-medium text-fg-muted">Services they cover</legend>
          <p className="text-label text-fg-muted">Leave all unticked to cover every service.</p>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-body text-fg">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-action"
                  checked={serviceIds.includes(s.id!)}
                  onChange={(e) => setServiceIds((ids) => (e.target.checked ? [...ids, s.id!] : ids.filter((x) => x !== s.id)))}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </div>
    </Modal>
  )
}
