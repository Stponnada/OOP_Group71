'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Bug } from 'lucide-react'
import { Button, Field, FormMessage, Modal, Textarea } from '@/components/ui'
import { reportIssue } from '@/app/(dashboard)/issues/actions'
import { DESCRIPTION_MAX } from '@/lib/issue-status'

/** Sidebar button: tell Engineering about something broken. The page you're on goes with it. */
export default function ReportIssueButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const field = useRef<HTMLTextAreaElement>(null)

  // The native dialog opens after render, so focus the box once it's showing.
  useEffect(() => {
    if (!open || sent) return
    const frame = requestAnimationFrame(() => field.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, sent])

  function close() {
    setOpen(false)
    setError(null)
    if (sent) {
      setSent(false)
      setText('')
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await reportIssue(text, `${pathname}${window.location.search}`)
      if ('error' in res) setError(res.error)
      else setSent(true)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
        aria-label="Report an issue"
        title="Report an issue"
      >
        <Bug size={18} strokeWidth={1.75} />
      </button>
      <Modal
        open={open}
        onClose={close}
        title={sent ? 'Thanks, it’s with Engineering' : 'Report an issue'}
        description={
          sent
            ? 'You’ll get a notification when it’s sorted.'
            : 'Something broken, wrong or confusing, or an idea to make Spotlight better? Tell us. We’ll include the page you’re on.'
        }
        footer={
          sent ? (
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="report-issue-form" disabled={pending || !text.trim()}>
                {pending ? 'Sending…' : 'Send report'}
              </Button>
            </>
          )
        }
      >
        {!sent && (
          <form id="report-issue-form" onSubmit={submit} className="space-y-3">
            <Field label="What’s going on?" hint="For a problem: what you did, what you expected, and what happened instead.">
              <Textarea
                rows={5}
                value={text}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setText(e.target.value)}
                ref={field}
              />
            </Field>
            {error && <FormMessage tone="error">{error}</FormMessage>}
          </form>
        )}
      </Modal>
    </>
  )
}
