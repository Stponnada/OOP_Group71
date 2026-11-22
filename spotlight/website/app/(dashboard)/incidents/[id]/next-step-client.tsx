'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Star } from 'lucide-react'
import { Button, Field, FormMessage, Panel, Textarea } from '@/components/ui'
import type { IncidentAction, IncidentStatus, TechnicianRecommendation } from '@/lib/itsm-types'
import { moveIncident, postNote, sendFeedback, takeIncident, type ActionResult } from '../actions'
import { AssignChooser } from './assign-client'

type Viewer = { isReporter: boolean; isAssignee: boolean; isAdmin: boolean }

/**
 * The one thing this person should do next, in words, with the control to do it. The buttons
 * come from the incident's `actions` (decided by the service for this caller), so the reporter
 * and the service desk see different panels for the same incident.
 */
export default function NextStep(props: {
  incidentId: string
  status: IncidentStatus
  actions: IncidentAction[]
  viewer: Viewer
  assigneeName: string | null
  reporterName: string | null
  resolutionNote: string | null
  awaitingReporter: boolean
  question: { body: string; by: string } | null
  resolutionDue: string | null
  cancellationReason: string | null
  feedback: { rating?: number; comment?: string | null } | null
  recommendations: TechnicianRecommendation[]
  strategyLabel: string | null
}) {
  const { incidentId, status, viewer, assigneeName, reporterName } = props
  const can = (a: IncidentAction) => props.actions.includes(a)
  const reporter = reporterName ?? 'The reporter'
  const assignee = assigneeName ?? 'The technician'

  if (status === 'CANCELLED') {
    return (
      <Step title="Cancelled" tone="muted">
        <p>{props.cancellationReason ?? 'This incident was cancelled.'}</p>
      </Step>
    )
  }

  if (can('RESPOND') && props.awaitingReporter && viewer.isReporter) {
    return <ReplyStep incidentId={incidentId} question={props.question} />
  }

  if (can('VERIFY')) {
    return <VerifyStep incidentId={incidentId} assignee={assignee} resolutionNote={props.resolutionNote} />
  }

  if (can('FEEDBACK')) {
    return <FeedbackStep incidentId={incidentId} />
  }

  // Closing is the service desk's step; the reporter's part ends with confirming and rating.
  if (can('CLOSE') && status === 'VERIFIED' && !viewer.isReporter) {
    return (
      <ActionStep
        title="Ready to close"
        primary={{ label: 'Close incident', pendingLabel: 'Closing…', run: () => moveIncident(incidentId, 'CLOSED') }}
      >
        <p>{reporter} confirmed the fix. Closing it stops the clock and records the outcome.</p>
      </ActionStep>
    )
  }

  if (!assigneeName && can('ASSIGN')) {
    return (
      <Step title="Assign a technician">
        <p className="mb-4">
          Nobody has this yet. The ranking weighs skills for this service, current workload, experience and past work on
          the service.
        </p>
        <AssignChooser incidentId={incidentId} recommendations={props.recommendations} strategyLabel={props.strategyLabel} />
        {can('TAKE') && <TakeYourself incidentId={incidentId} />}
      </Step>
    )
  }

  if (can('TAKE') && !assigneeName) {
    return (
      <ActionStep
        title="Unassigned"
        primary={{ label: 'Take it', pendingLabel: 'Taking…', run: () => takeIncident(incidentId) }}
      >
        <p>Nobody has picked this up yet. Taking it assigns it to you and tells {reporter}.</p>
      </ActionStep>
    )
  }

  if (can('ACKNOWLEDGE')) {
    return (
      <ActionStep
        title="Assigned to you"
        primary={{ label: 'Acknowledge', pendingLabel: 'Acknowledging…', run: () => moveIncident(incidentId, 'ACKNOWLEDGED') }}
      >
        <p>Acknowledging tells {reporter} you have seen it and records your first response against the SLA.</p>
      </ActionStep>
    )
  }

  if (can('START_WORK') && status === 'ACKNOWLEDGED') {
    return (
      <ActionStep
        title="Acknowledged"
        primary={{ label: 'Start work', pendingLabel: 'Starting…', run: () => moveIncident(incidentId, 'IN_PROGRESS') }}
      >
        <p>Start work when you begin investigating. Use Activity below to ask {reporter} anything you need.</p>
      </ActionStep>
    )
  }

  if (can('RESOLVE')) {
    return <ResolveStep incidentId={incidentId} reporter={reporter} awaiting={props.awaitingReporter} />
  }

  // Nothing to do here right now: say what is happening and who has the ball.
  return <WaitingStep {...props} reporter={reporter} assignee={assignee} />
}

function WaitingStep({
  status,
  viewer,
  assigneeName,
  assignee,
  reporter,
  awaitingReporter,
  feedback,
}: {
  status: IncidentStatus
  viewer: Viewer
  assigneeName: string | null
  assignee: string
  reporter: string
  awaitingReporter: boolean
  feedback: { rating?: number; comment?: string | null } | null
}) {
  let text: ReactNode
  if (status === 'CLOSED') {
    text = feedback?.rating
      ? `Closed. ${viewer.isReporter ? 'You' : reporter} rated the fix ${feedback.rating}/5${feedback.comment ? `: “${feedback.comment}”` : '.'}`
      : 'Closed.'
  } else if (status === 'VERIFIED') {
    text = viewer.isReporter ? 'You confirmed the fix. The service desk will close it.' : `${reporter} confirmed the fix. The service desk closes it.`
  } else if (status === 'RESOLVED') {
    text = `Waiting for ${viewer.isReporter ? 'you' : reporter} to confirm the fix.`
  } else if (awaitingReporter) {
    text = viewer.isReporter ? `${assignee} asked you a question. Reply under Activity.` : `Waiting for ${reporter} to answer your question.`
  } else if (!assigneeName) {
    text = 'The service desk is finding a technician. You will be notified when someone picks it up.'
  } else if (status === 'ASSIGNED') {
    text = viewer.isReporter
      ? `${assignee} has been assigned and will pick it up shortly.`
      : `Assigned to ${assignee}. Waiting for them to acknowledge it.`
  } else if (viewer.isReporter) {
    text = `${assignee} is working on it. You will be notified when it is resolved.`
  } else {
    text = `${assignee} is working on it.`
  }
  return (
    <Step title="Where it stands" tone="muted">
      <p>{text}</p>
    </Step>
  )
}

function ReplyStep({ incidentId, question }: { incidentId: string; question: { body: string; by: string } | null }) {
  const [text, setText] = useState('')
  const { pending, error, run } = useAction()
  return (
    <Step title={`${question?.by ?? 'The technician'} needs more information`}>
      {question && <blockquote className="mb-4 border-l-2 border-warning pl-3 text-fg">{question.body}</blockquote>}
      <Field label="Your answer">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
      </Field>
      <Footer error={error}>
        <Button variant="primary" pending={pending} pendingLabel="Sending…" disabled={!text.trim()} onClick={() => run(() => postNote(incidentId, 'INFO_RESPONSE', text), () => setText(''))}>
          Send reply
        </Button>
      </Footer>
    </Step>
  )
}

function VerifyStep({ incidentId, assignee, resolutionNote }: { incidentId: string; assignee: string; resolutionNote: string | null }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const { pending, error, run } = useAction()
  return (
    <Step title="Is it fixed?">
      <p>{assignee} marked this resolved.</p>
      {resolutionNote && <blockquote className="mt-3 border-l-2 border-success pl-3 text-fg">{resolutionNote}</blockquote>}
      {rejecting && (
        <div className="mt-4">
          <Field label="What is still wrong?" required>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} autoFocus />
          </Field>
        </div>
      )}
      <Footer error={error}>
        {rejecting ? (
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
              Back
            </Button>
            <Button
              variant="primary"
              pending={pending}
              pendingLabel="Sending back…"
              disabled={!reason.trim()}
              onClick={() => run(() => moveIncident(incidentId, 'IN_PROGRESS', { reason }))}
            >
              Send back to {assignee}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>
              No, still broken
            </Button>
            <Button variant="primary" pending={pending} pendingLabel="Confirming…" onClick={() => run(() => moveIncident(incidentId, 'VERIFIED'))}>
              Yes, it’s fixed
            </Button>
          </>
        )}
      </Footer>
    </Step>
  )
}

function FeedbackStep({ incidentId }: { incidentId: string }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const { pending, error, run } = useAction()
  return (
    <Step title="How did we do?">
      <p>Thanks for confirming. A rating helps the service desk see what works.</p>
      <fieldset className="mt-4">
        <legend className="text-label text-fg-muted">Rating</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rating === n}
              aria-label={`${n} out of 5`}
              onClick={() => setRating(n)}
              className="rounded-md p-1 text-fg-subtle hover:text-warning focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Star size={24} className={n <= rating ? 'fill-warning text-warning' : ''} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <Field label="Anything to add?">
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </Field>
      </div>
      <Footer error={error}>
        <Button variant="primary" pending={pending} pendingLabel="Sending…" disabled={rating === 0} onClick={() => run(() => sendFeedback(incidentId, rating, comment))}>
          Send feedback
        </Button>
      </Footer>
    </Step>
  )
}

function ResolveStep({ incidentId, reporter, awaiting }: { incidentId: string; reporter: string; awaiting: boolean }) {
  const [note, setNote] = useState('')
  const { pending, error, run } = useAction()
  return (
    <Step title="In progress">
      <p>
        {awaiting
          ? `You asked ${reporter} a question and are waiting for the answer. You can still resolve if you have found the fix.`
          : `When it is fixed, say what you did. ${reporter} is asked to confirm before it closes.`}
      </p>
      <div className="mt-4">
        <Field label="What fixed it?" hint="Shown to the reporter and offered to the next technician who sees something similar.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
        </Field>
      </div>
      <Footer error={error}>
        <Button
          variant="primary"
          pending={pending}
          pendingLabel="Resolving…"
          disabled={!note.trim()}
          onClick={() => run(() => moveIncident(incidentId, 'RESOLVED', { resolutionNote: note }), () => setNote(''))}
        >
          Resolve
        </Button>
      </Footer>
    </Step>
  )
}

function ActionStep({
  title,
  children,
  primary,
}: {
  title: string
  children: ReactNode
  primary: { label: string; pendingLabel: string; run: () => Promise<ActionResult> }
}) {
  const { pending, error, run } = useAction()
  return (
    <Step title={title}>
      {children}
      <Footer error={error}>
        <Button variant="primary" pending={pending} pendingLabel={primary.pendingLabel} onClick={() => run(primary.run)}>
          {primary.label}
        </Button>
      </Footer>
    </Step>
  )
}

/** For a service-desk admin who is also a technician: skip the ranking and take it. */
function TakeYourself({ incidentId }: { incidentId: string }) {
  const { pending, error, run } = useAction()
  return (
    <Footer error={error}>
      <Button variant="secondary" pending={pending} pendingLabel="Taking…" onClick={() => run(() => takeIncident(incidentId))}>
        Take it yourself
      </Button>
    </Footer>
  )
}

function Step({ title, children, tone }: { title: string; children: ReactNode; tone?: 'muted' }) {
  return (
    <Panel title={title} className={tone === 'muted' ? '' : 'ring-1 ring-action/30'}>
      <div className="text-body text-fg">{children}</div>
    </Panel>
  )
}

function Footer({ children, error }: { children: ReactNode; error: string | null }) {
  return (
    <div className="mt-4 space-y-3">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  )
}

function useAction() {
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
  return { pending, error, run }
}
