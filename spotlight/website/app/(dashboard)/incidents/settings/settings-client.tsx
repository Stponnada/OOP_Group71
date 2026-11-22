'use client'

import { useState, useTransition } from 'react'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FormMessage,
  Input,
  Modal,
  Select,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
} from '@/components/ui'
import type {
  AssignmentSettings,
  BusinessCriticality,
  Category,
  Priority,
  Service,
  Skill,
  SlaProfile,
} from '@/lib/itsm-types'
import { chooseStrategy, saveCategory, saveService, saveSlaProfile, type ActionResult } from '../actions'
import { duration, humanize } from '../_components/format'

const CRITICALITIES: BusinessCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'REVENUE_OR_REGULATED']
const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4']

function useSave() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null)
    start(async () => {
      const res = await action()
      if ('error' in res) setError(res.error)
      else onOk?.()
    })
  }
  return { pending, error, setError, run }
}

function ActiveBadge({ active }: { active?: boolean }) {
  return active === false ? <Badge>Retired</Badge> : <Badge tone="positive">Active</Badge>
}

// ── Services ────────────────────────────────────────────────────────────────

export function ServicesTab({
  services,
  categories,
  skills,
  profiles,
}: {
  services: Service[]
  categories: Category[]
  skills: Skill[]
  profiles: SlaProfile[]
}) {
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const profileName = new Map(profiles.map((p) => [p.id, p.name]))
  const skillName = new Map(skills.map((s) => [s.id, s.name]))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-fg-muted">
          Criticality feeds the priority, the SLA profile sets the deadlines, required skills steer skill-based assignment.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          Add service
        </Button>
      </div>
      <Table caption="Services" minWidth={760}>
        <THead>
          <Th>Service</Th>
          <Th>Category</Th>
          <Th>Criticality</Th>
          <Th>SLA profile</Th>
          <Th>Required skills</Th>
          <Th>Status</Th>
          <Th className="text-right">Edit</Th>
        </THead>
        <TBody>
          {services.map((s) => (
            <Tr key={s.id}>
              <Td>
                <p className="font-medium text-fg">{s.name}</p>
                <p className="text-label text-fg-muted">{s.code}</p>
              </Td>
              <Td muted>{categoryName.get(s.categoryId) ?? '—'}</Td>
              <Td muted>{humanize(s.businessCriticality)}</Td>
              <Td muted>{s.slaProfileId ? profileName.get(s.slaProfileId) : 'Default'}</Td>
              <Td muted>{(s.requiredSkillIds ?? []).map((id) => skillName.get(id)).filter(Boolean).join(', ') || '—'}</Td>
              <Td>
                <ActiveBadge active={s.isActive} />
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {editing && (
        <ServiceModal
          key={editing === 'new' ? 'new' : editing.id}
          service={editing === 'new' ? null : editing}
          categories={categories}
          skills={skills}
          profiles={profiles}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ServiceModal({
  service,
  categories,
  skills,
  profiles,
  onClose,
}: {
  service: Service | null
  categories: Category[]
  skills: Skill[]
  profiles: SlaProfile[]
  onClose: () => void
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [code, setCode] = useState(service?.code ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [categoryId, setCategoryId] = useState(service?.categoryId ?? '')
  const [criticality, setCriticality] = useState<BusinessCriticality>(service?.businessCriticality ?? 'MEDIUM')
  const [profileId, setProfileId] = useState(service?.slaProfileId ?? '')
  const [required, setRequired] = useState<string[]>(service?.requiredSkillIds ?? [])
  const [active, setActive] = useState(service?.isActive !== false)
  const { pending, error, setError, run } = useSave()

  function save() {
    if (name.trim().length < 2) return setError('Give the service a name.')
    if (!categoryId) return setError('Pick a category.')
    run(
      () =>
        saveService(service?.id ?? null, {
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || null,
          categoryId,
          businessCriticality: criticality,
          slaProfileId: profileId || null,
          isActive: active,
          requiredSkillIds: required,
        }),
      onClose,
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={service ? `Edit ${service.name}` : 'Add a service'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={pending} pendingLabel="Saving…" onClick={save}>
            {service ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </Field>
          <Field label="Code" hint="Short and unique, like VPN. Generated if left blank.">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={40} />
          </Field>
          <Field label="Category" required>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>
                Select category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Business criticality" hint="A wide outage on a revenue or regulated service is always at least P2.">
            <Select value={criticality} onChange={(e) => setCriticality(e.target.value as BusinessCriticality)}>
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SLA profile">
            <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">Default</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-body text-fg">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-action" />
            Open for new reports
          </label>
        </div>
        <Field label="Description" hint="Shown to people choosing a service.">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>
        <fieldset>
          <legend className="text-label font-medium text-fg-muted">Required skills</legend>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {skills.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-body text-fg">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-action"
                  checked={required.includes(s.id!)}
                  onChange={(e) => setRequired((r) => (e.target.checked ? [...r, s.id!] : r.filter((x) => x !== s.id)))}
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

// ── Categories ──────────────────────────────────────────────────────────────

export function CategoriesTab({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-fg-muted">The first question on the report form. Retiring one hides it from new reports.</p>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          Add category
        </Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState compact title="No categories" />
      ) : (
        <Table caption="Categories" minWidth={560}>
          <THead>
            <Th>Category</Th>
            <Th>Description</Th>
            <Th>Order</Th>
            <Th>Status</Th>
            <Th className="text-right">Edit</Th>
          </THead>
          <TBody>
            {categories.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <p className="font-medium text-fg">{c.name}</p>
                  <p className="text-label text-fg-muted">{c.code}</p>
                </Td>
                <Td muted>{c.description ?? '—'}</Td>
                <Td muted>{c.sortOrder ?? 0}</Td>
                <Td>
                  <ActiveBadge active={c.isActive} />
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && <CategoryModal key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [code, setCode] = useState(category?.code ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [order, setOrder] = useState(String(category?.sortOrder ?? 0))
  const [active, setActive] = useState(category?.isActive !== false)
  const { pending, error, setError, run } = useSave()

  function save() {
    if (name.trim().length < 2) return setError('Give the category a name.')
    run(
      () =>
        saveCategory(category?.id ?? null, {
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || null,
          sortOrder: Number(order) || 0,
          isActive: active,
        }),
      onClose,
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? `Edit ${category.name}` : 'Add a category'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={pending} pendingLabel="Saving…" onClick={save}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </Field>
          <Field label="Code" hint="Generated if left blank.">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={40} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order on the form">
            <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-body text-fg">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-action" />
            Open for new reports
          </label>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </div>
    </Modal>
  )
}

// ── SLA policies ────────────────────────────────────────────────────────────

export function SlaTab({ profiles }: { profiles: SlaProfile[] }) {
  if (profiles.length === 0) return <EmptyState compact title="No SLA profiles" />
  return (
    <div className="space-y-6">
      <p className="text-body text-fg-muted">
        Deadlines run from when an incident is reported. The warning goes to the technician once that share of the
        resolution time has passed; escalation starts at the deadline. Changes apply to incidents reported afterwards.
      </p>
      {profiles.map((p) => (
        <SlaProfileEditor key={p.id} profile={p} />
      ))}
    </div>
  )
}

type TargetDraft = { responseMinutes: string; resolutionMinutes: string; warningPercent: string }

function SlaProfileEditor({ profile }: { profile: SlaProfile }) {
  const initial = Object.fromEntries(
    PRIORITIES.map((p) => {
      const t = profile.targets?.find((x) => x.priority === p)
      return [
        p,
        {
          responseMinutes: String(t?.responseMinutes ?? ''),
          resolutionMinutes: String(t?.resolutionMinutes ?? ''),
          warningPercent: String(t?.warningPercent ?? 75),
        },
      ]
    }),
  ) as Record<Priority, TargetDraft>
  const [name, setName] = useState(profile.name ?? '')
  const [targets, setTargets] = useState(initial)
  const [saved, setSaved] = useState(false)
  const { pending, error, setError, run } = useSave()
  const dirty = name !== (profile.name ?? '') || JSON.stringify(targets) !== JSON.stringify(initial)

  function set(p: Priority, field: keyof TargetDraft, value: string) {
    setSaved(false)
    setTargets((t) => ({ ...t, [p]: { ...t[p], [field]: value } }))
  }

  function save() {
    const rows = PRIORITIES.filter((p) => targets[p].responseMinutes !== '' || targets[p].resolutionMinutes !== '').map((p) => ({
      priority: p,
      responseMinutes: Number(targets[p].responseMinutes),
      resolutionMinutes: Number(targets[p].resolutionMinutes),
      warningPercent: Number(targets[p].warningPercent),
    }))
    for (const r of rows) {
      if (!(r.responseMinutes > 0) || !(r.resolutionMinutes > 0)) return setError(`${r.priority}: both times must be more than zero minutes.`)
      if (r.resolutionMinutes < r.responseMinutes) return setError(`${r.priority}: resolution can’t be due before the first response.`)
      if (!(r.warningPercent >= 1 && r.warningPercent <= 100)) return setError(`${r.priority}: the warning is a percentage from 1 to 100.`)
    }
    run(() => saveSlaProfile(profile.id!, { name: name.trim() || profile.name, targets: rows }), () => setSaved(true))
  }

  return (
    <section className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Profile name">
          <Input value={name} onChange={(e) => (setSaved(false), setName(e.target.value))} className="sm:w-72" />
        </Field>
        <span className="text-label text-fg-muted">{profile.code}</span>
      </div>
      <Table caption={`${profile.name} targets`} minWidth={560}>
        <THead>
          <Th>Priority</Th>
          <Th>First response within (minutes)</Th>
          <Th>Resolve within (minutes)</Th>
          <Th>Warn at (% of resolution time)</Th>
        </THead>
        <TBody>
          {PRIORITIES.map((p) => (
            <Tr key={p}>
              <Td nowrap className="font-medium">
                {p}
              </Td>
              <Td>
                <Input type="number" min={1} aria-label={`${p} response minutes`} value={targets[p].responseMinutes} onChange={(e) => set(p, 'responseMinutes', e.target.value)} />
                <span className="text-label text-fg-muted">{duration(Number(targets[p].responseMinutes) || null)}</span>
              </Td>
              <Td>
                <Input type="number" min={1} aria-label={`${p} resolution minutes`} value={targets[p].resolutionMinutes} onChange={(e) => set(p, 'resolutionMinutes', e.target.value)} />
                <span className="text-label text-fg-muted">{duration(Number(targets[p].resolutionMinutes) || null)}</span>
              </Td>
              <Td>
                <Input type="number" min={1} max={100} aria-label={`${p} warning percent`} value={targets[p].warningPercent} onChange={(e) => set(p, 'warningPercent', e.target.value)} />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <div className="mt-3 flex items-center justify-end gap-3">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {saved && !dirty && <span className="text-label text-success">Saved</span>}
        <Button variant="secondary" size="sm" pending={pending} pendingLabel="Saving…" disabled={!dirty} onClick={save}>
          Save {profile.name}
        </Button>
      </div>
    </section>
  )
}

// ── Assignment strategy ─────────────────────────────────────────────────────

const STRATEGY_HELP: Record<string, string> = {
  'skill-based': 'Best match for the service’s required skills, then experience. Good when expertise matters most.',
  'load-based': 'Whoever has the most room under their limit. Keeps work even across the team.',
  'round-robin': 'Takes turns through the available technicians. Simple and predictable.',
  'priority-aware': 'Critical work goes to the most experienced technician who knows the service; routine work is spread by load.',
}

export function StrategyTab({ settings }: { settings: AssignmentSettings | null }) {
  const [choice, setChoice] = useState(settings?.defaultStrategyKey ?? '')
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useSave()
  if (!settings) return <EmptyState compact tone="error" title="Assignment settings unavailable" />
  const dirty = choice !== settings.defaultStrategyKey
  return (
    <div className="space-y-4">
      <p className="text-body text-fg-muted">
        Used when an incident is reported and when someone presses Auto-assign. Recommendations on an incident show every
        strategy’s pick either way.
      </p>
      <div role="radiogroup" aria-label="Assignment strategy" className="grid gap-3 sm:grid-cols-2">
        {(settings.strategies ?? []).map((s) => (
          <label
            key={s.key}
            className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 ${choice === s.key ? 'border-action' : 'border-line'}`}
          >
            <input
              type="radio"
              name="strategy"
              className="mt-1 h-4 w-4 accent-action"
              checked={choice === s.key}
              onChange={() => (setSaved(false), setChoice(s.key!))}
            />
            <span>
              <span className="flex items-center gap-2 text-body font-medium text-fg">
                {s.label}
                {s.key === settings.defaultStrategyKey && <Badge tone="positive">In use</Badge>}
              </span>
              <span className="block text-label text-fg-muted">{STRATEGY_HELP[s.key ?? ''] ?? ''}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {saved && !dirty && <span className="text-label text-success">Saved</span>}
        <Button variant="primary" pending={pending} pendingLabel="Saving…" disabled={!dirty} onClick={() => run(() => chooseStrategy(choice), () => setSaved(true))}>
          Use this strategy
        </Button>
      </div>
    </div>
  )
}
