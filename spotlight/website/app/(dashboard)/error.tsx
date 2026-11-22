'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { Button, EmptyState, Page, buttonClass } from '@/components/ui'

// Catches anything a dashboard page or server action throws. The sidebar and shell stay
// on screen, so the user can retry or go elsewhere instead of facing a blank error screen.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Page>
      <div className="rounded-md border border-line bg-surface">
        <EmptyState
          tone="error"
          title="This page couldn't load."
          description={
            <>
              Something went wrong on our side. Try again; if it keeps happening, send the reference below to the
              Spotlight team.
              {error.digest && <span className="mt-2 block text-label text-fg-subtle">Reference: {error.digest}</span>}
            </>
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => unstable_retry()}>
                Try again
              </Button>
              <Link href="/dashboard" className={buttonClass({ variant: 'secondary' })}>
                Go to dashboard
              </Link>
            </div>
          }
        />
      </div>
    </Page>
  )
}
