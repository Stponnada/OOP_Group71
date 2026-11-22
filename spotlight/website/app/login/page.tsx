'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const OAUTH_ERRORS: Record<string, string> = {
  no_account: 'Your Google account isn\'t linked to an employee record. Contact your admin.',
  oauth_error: 'Google sign-in failed. Please try again.',
  no_code: 'Sign-in was cancelled. Please try again.',
  invalid_link: 'This sign-in or password reset link is invalid or has expired. Please request a new link.',
}

const BeaconSVG = () => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xmlSpace="preserve" className="w-72 h-72 drop-shadow-2xl" aria-hidden="true">
    <rect y="420.571" style={{ fill: '#3FA9F5' }} width="512" height="88.816" />
    <rect x="67.918" y="107.102" style={{ fill: '#f90000' }} width="125.388" height="36.571" />
    <path style={{ fill: '#E6E6E6' }} d="M193.306,54.857v52.245H67.918V54.857c0-5.747,4.702-10.449,10.449-10.449h52.245h52.245 C188.604,44.408,193.306,49.11,193.306,54.857z" />
    <polygon style={{ fill: '#999999' }} points="193.306,143.673 224.653,143.673 224.653,175.02 193.306,175.02 67.918,175.02 36.571,175.02 36.571,143.673 67.918,143.673" />
    <g>
      <rect x="67.918" y="211.592" style={{ fill: '#f90000' }} width="125.388" height="41.796" />
      <rect x="67.918" y="295.184" style={{ fill: '#f90000' }} width="125.388" height="41.796" />
    </g>
    <g>
      <polygon style={{ fill: '#E6E6E6' }} points="193.306,336.98 193.306,365.192 151.51,373.551 67.918,361.012 67.918,336.98" />
      <rect x="67.918" y="253.388" style={{ fill: '#E6E6E6' }} width="125.388" height="41.796" />
      <rect x="67.918" y="175.02" style={{ fill: '#E6E6E6' }} width="125.388" height="36.571" />
    </g>
    <polygon style={{ fill: '#A67C52' }} points="193.306,365.192 229.878,357.878 334.367,420.571 20.898,420.571 47.02,357.878 67.918,361.012 151.51,373.551" />
    <rect x="198.531" y="464.98" width="52.245" height="15.673" /><rect x="266.449" y="464.98" width="20.898" height="15.673" /><rect x="391.837" y="454.531" width="52.245" height="15.673" /><rect x="355.265" y="454.531" width="20.898" height="15.673" /><rect x="78.367" y="454.531" width="52.245" height="15.673" /><rect x="41.796" y="454.531" width="20.898" height="15.673" />
    <path d="M336.538,412.735l-105.226-63.136l-30.168,6.033V182.857h31.347v-47.02h-31.347v-80.98c0-10.082-8.203-18.286-18.286-18.286 h-44.408V2.612h-15.673v33.959H78.367c-10.082,0-18.286,8.203-18.286,18.286v80.98H28.735v47.02h31.347v169.055l-17.944-2.692 l-26.464,63.514H0v15.673h512v-15.673H336.538z M75.755,219.429h109.714v26.122H75.755V219.429z M75.755,261.224h109.714v26.122 H75.755V261.224z M75.755,303.02h109.714v26.122H75.755V303.02z M78.367,52.245h104.49c1.416,0,2.612,1.196,2.612,2.612v44.408 H75.755V54.857C75.755,53.441,76.951,52.245,78.367,52.245z M75.755,114.939h109.714v20.898H75.755V114.939z M44.408,151.51h172.408 v15.673H44.408V151.51z M185.469,182.857v20.898H75.755v-20.898H185.469z M75.755,344.816h109.714v13.95l-34.152,6.83 l-75.562-11.334V344.816z M51.903,366.535l99.8,14.97l76.74-15.348l77.631,46.578H32.653L51.903,366.535z" />
    <rect x="88.816" y="67.918" width="20.898" height="15.673" /><rect x="120.163" y="67.918" width="20.898" height="15.673" /><rect x="151.51" y="67.918" width="20.898" height="15.673" />
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'forgot' | 'forgot-sent' | 'magic' | 'magic-sent'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const authError = searchParams.get('error')
    return authError ? OAUTH_ERRORS[authError] ?? null : null
  })
  const [loading, setLoading] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMode('magic-sent')
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMode('forgot-sent')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — beacon */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col items-center justify-center relative overflow-hidden select-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-10">
          <div className="text-center">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-gray-500 mb-2">Spotlight</p>
            <h1 className="text-5xl font-bold tracking-tight text-white">Spotlight</h1>
            <p className="text-sm text-gray-500 mt-3 max-w-xs leading-relaxed">Internal operations platform</p>
          </div>
          <BeaconSVG />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">
        {/* Mobile branding */}
        <div className="lg:hidden text-center mb-10">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-400 mb-1">Spotlight</p>
          <h1 className="text-2xl font-bold text-gray-900">Spotlight</h1>
        </div>

        <div className="w-full max-w-sm">

          {/* Sign in */}
          {mode === 'login' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900">Sign in</h2>
                <p className="text-sm text-gray-400 mt-1">Enter your work credentials to continue</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">Work Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-medium text-gray-500">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-400">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => { setMode('magic'); setError(null) }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2"
              >
                Or sign in with email link instead →
              </button>
            </>
          )}

          {/* Magic link form */}
          {mode === 'magic' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900">Email sign-in</h2>
                <p className="text-sm text-gray-400 mt-1">We&apos;ll send a one-click sign-in link to your work email</p>
              </div>
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="magic-email" className="block text-xs font-medium text-gray-500 mb-1.5">Work Email</label>
                  <input
                    id="magic-email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Send Sign-in Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null) }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}

          {/* Magic link sent */}
          {mode === 'magic-sent' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-400 mb-2">
                We sent a sign-in link to
              </p>
              <p className="text-sm font-medium text-gray-700 mb-6">{email}</p>
              <p className="text-xs text-gray-400 mb-6">The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>
              <button
                type="button"
                onClick={() => { setMode('magic'); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Send another link
              </button>
            </div>
          )}

          {/* Forgot password */}
          {mode === 'forgot' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900">Reset password</h2>
                <p className="text-sm text-gray-400 mt-1">We&apos;ll send a reset link to your work email</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-medium text-gray-500 mb-1.5">Work Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null) }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}

          {/* Sent confirmation */}
          {mode === 'forgot-sent' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-400 mb-6">
                We sent a password reset link to <span className="font-medium text-gray-600">{email}</span>
              </p>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
