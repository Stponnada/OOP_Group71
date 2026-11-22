'use client' // Error boundaries must be Client Components

// Last-resort boundary: replaces the root layout when it fails, so it brings its own
// <html>/<body> and inline styles (globals.css may be what failed).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1220',
          color: '#e7edf5',
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Spotlight couldn&apos;t load.</h1>
          <p style={{ fontSize: 14, color: '#a3b0c1', margin: '0 0 20px' }}>
            Something went wrong on our side. Try again; if it keeps happening, send the reference below to the
            Spotlight team.
            {error.digest && <span style={{ display: 'block', marginTop: 8, fontSize: 12 }}>Reference: {error.digest}</span>}
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 6,
              border: 0,
              background: '#e7edf5',
              color: '#0b1220',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
