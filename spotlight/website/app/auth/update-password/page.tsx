'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
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
            <p className="text-sm text-gray-500 mt-3">Internal operations platform</p>
          </div>
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
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">Set your password</h2>
            <p className="text-sm text-gray-400 mt-1">Choose a password for your Spotlight account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1.5">
                New Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-xs font-medium text-gray-500 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Saving…' : 'Set Password & Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
