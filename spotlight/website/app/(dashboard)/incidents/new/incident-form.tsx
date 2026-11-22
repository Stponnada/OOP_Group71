'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge, Button, Field, FormMessage, Input, Select, Textarea } from '@/components/ui'
import type { CategorisationSuggestion, Impact, SimilarIncident, Urgency } from '@/lib/itsm-types'
import { similarReports, suggestClassification } from '../actions'
import { IMPACT_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../_components/format'
import { reportIncident } from './actions'

export type CatalogCategory = { id: string; name: string }
export type CatalogService = { id: string; name: string; categoryId: string | null }

const IMPACTS = Object.keys(IMPACT_LABEL) as Impact[]
const URGENCIES = Object.keys(URGENCY_LABEL) as Urgency[]

/**
 * The report form. Two helpers run while the reporter types, both read-only: a suggested
 * category and service from the description, and a check for open reports of the same problem.
 * Priority and the SLA are never chosen here; the service derives them on submit.
 */
export default function IncidentForm({
  categories,
  services,
  catalogError,
}: {
  categories: CatalogCategory[]
  services: CatalogService[]
  catalogError: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [impact, setImpact] = useState<Impact | ''>('')
  const [urgency, setUrgency] = useState<Urgency | ''>('')
  const [suggestion, setSuggestion] = useState<CategorisationSuggestion | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [similar, setSimilar] = useState<{ serviceId: string; items: SimilarIncident[] }>({ serviceId: '', items: [] })
  const lastSuggested = useRef('')

  const inCategory = services.filter((s) => s.categoryId === categoryId)
  const serviceOptions = inCategory.length > 0 ? inCategory : services
  const serviceHint = !categoryId
    ? 'Pick a category first.'
    : inCategory.length === 0
      ? 'No services are listed under this category yet. Pick the closest one.'
      : undefined
  const catalogUnavailable = catalogError !== null || categories.length === 0 || services.length === 0

  // Look for open reports of the same thing once there is a service and something to compare.
  const canCompare = Boolean(serviceId) && (title.trim().length >= 3 || description.trim().length >= 10)
  useEffect(() => {
    if (!canCompare) return
    let live = true
    const t = setTimeout(async () => {
      const found = await similarReports(serviceId, title, description)
      const open = found.filter((s) => s.status !== 'CLOSED' && s.status !== 'CANCELLED').slice(0, 3)
      if (live) setSimilar({ serviceId, items: open })
    }, 600)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [canCompare, serviceId, title, description])
  // Results for another service, or from before the text was cleared, are not shown.
  const similarShown = canCompare && similar.serviceId === serviceId ? similar.items : []

  async function suggest() {
    const text = `${title}\n${description}`.trim()
    if (categoryId || suggestionDismissed || text.length < 10 || text === lastSuggested.current) return
    lastSuggested.current = text
    const s = await suggestClassification(text)
    setSuggestion(s && (s.categoryId || s.serviceId) ? s : null)
  }

  function applySuggestion() {
    if (!suggestion) return
    if (suggestion.categoryId) setCategoryId(suggestion.categoryId)
    if (suggestion.serviceId) setServiceId(suggestion.serviceId)
    // Impact and urgency stay the reporter's call: they drive the priority.
    setSuggestion(null)
  }

  function submit(formData: FormData) {
    setError(null)
    start(async () => {
      const res = await reportIncident(formData)
      // On success the action redirects to the new incident.
      if (res && 'error' in res) setError(res.error)
    })
  }

  return (
    <form action={submit} className="space-y-5">
      <Field label="What is broken?" required hint="A short summary, like “VPN drops every few minutes”.">
        <Input name="title" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="What happened?" required hint="What you were doing, what you expected, and what you saw instead.">
        <Textarea
          name="description"
          required
          rows={5}
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={suggest}
        />
      </Field>

      {suggestion && !categoryId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-sunken px-4 py-3">
          <p className="flex items-center gap-2 text-body text-fg">
            <Sparkles size={16} aria-hidden="true" className="text-action" />
            <span>
              This sounds like <strong>{[suggestion.categoryName, suggestion.serviceName].filter(Boolean).join(' › ')}</strong>
              {suggestion.matchedTerms?.length ? (
                <span className="text-fg-muted"> (from “{suggestion.matchedTerms.slice(0, 3).join('”, “')}”)</span>
              ) : null}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSuggestion(null)
                setSuggestionDismissed(true)
              }}
            >
              No thanks
            </Button>
            <Button size="sm" variant="secondary" onClick={applySuggestion}>
              Use this
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required>
          <Select
            name="categoryId"
            required
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setServiceId('')
            }}
            disabled={catalogUnavailable}
          >
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
        <Field label="Service" required hint={serviceHint}>
          <Select
            name="serviceId"
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={catalogUnavailable || !categoryId}
          >
            <option value="" disabled>
              Select service
            </option>
            {serviceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {similarShown.length > 0 && (
        <div className="rounded-md border border-warning bg-warning-soft px-4 py-3" role="status">
          <p className="text-body font-medium text-fg">Others have reported something similar</p>
          <ul className="mt-2 space-y-1.5 text-body">
            {similarShown.map((s) => (
              <li key={s.incidentId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.reference}</span>
                <span className="text-fg">{s.title}</span>
                {s.status && <Badge>{STATUS_LABEL[s.status]}</Badge>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-label text-fg-muted">
            Report it anyway: Spotlight links matching reports, so the service desk fixes them together and everyone who
            reported it hears when it’s done.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many people does it affect?" required>
          <Select name="impact" required value={impact} onChange={(e) => setImpact(e.target.value as Impact)}>
            <option value="" disabled>
              Select impact
            </option>
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                {IMPACT_LABEL[i]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How much is it stopping work?" required>
          <Select name="urgency" required value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
            <option value="" disabled>
              Select urgency
            </option>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Number of people affected" hint="Your best guess. Defaults to 1.">
          <Input name="affectedUsers" type="number" min={1} max={100000} defaultValue={1} />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-md border border-line px-4 py-3">
        <input type="checkbox" name="securityIncident" className="mt-1 h-4 w-4 accent-action" />
        <span>
          <span className="block text-body font-medium text-fg">This could be a security problem</span>
          <span className="block text-label text-fg-muted">
            A suspicious email, a lost laptop, someone else using your account. Security reports always go in as P1.
          </span>
        </span>
      </label>

      {catalogUnavailable && (
        <FormMessage tone="error">
          {`The IT service catalog couldn't be loaded${catalogError ? ` (${catalogError})` : ''}, so incidents can't be reported right now. Try again in a minute.`}
        </FormMessage>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex items-center justify-between gap-4">
        <p className="text-label text-fg-muted">Priority and deadlines are set from your answers when you submit.</p>
        <Button type="submit" variant="primary" pending={pending} pendingLabel="Reporting…" disabled={catalogUnavailable}>
          Report incident
        </Button>
      </div>
    </form>
  )
}
