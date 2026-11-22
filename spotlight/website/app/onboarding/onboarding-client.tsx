'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AccessLevel } from '@/lib/access'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeInfo {
  id: string
  first_name: string
  last_name: string
  email: string
  employee_code: string
  designation: string | null
}

interface OnboardingProps {
  employee: EmployeeInfo
  accessLevel: AccessLevel
  mustChangePassword: boolean
}

// ─── Feature definitions ──────────────────────────────────────────────────────

const CORE_FEATURES = [
  { emoji: '💬', name: 'Home', desc: 'Ask Mariner about your incidents, or have it report one for you.' },
  { emoji: '🛠️', name: 'My Incidents', desc: 'Report an IT problem, see its priority and SLA, and follow it to resolution.' },
  { emoji: '🔔', name: 'Notifications', desc: 'Hear when your incident is assigned, progresses, or is resolved.' },
  { emoji: '🐞', name: 'Report a problem', desc: 'Something wrong with Spotlight itself? Report it from any page.' },
]

const HR_FEATURES = [
  { emoji: '👥', name: 'Employees', desc: 'Manage team members, create accounts, assign roles, and track the org.' },
]

const ADMIN_FEATURES = [
  { emoji: '⚙️', name: 'Company Settings', desc: 'Departments and roles.' },
]

function getFeatureSections(accessLevel: AccessLevel) {
  const isDeptAdmin = accessLevel === 'admin' || accessLevel === 'superuser'
  const isSysAdmin = accessLevel === 'superuser'

  const sections: { title: string; features: typeof CORE_FEATURES }[] = [
    { title: 'Your Workspace', features: CORE_FEATURES },
  ]

  if (isDeptAdmin) {
    sections.push({ title: 'People', features: HR_FEATURES })
  }

  if (isSysAdmin) {
    sections.push({ title: 'Administration', features: ADMIN_FEATURES })
  }

  return sections
}

function getAccessLabel(accessLevel: AccessLevel): string {
  if (accessLevel === 'superuser') return 'Superuser'
  if (accessLevel === 'admin') return 'Admin'
  return 'Team Member'
}

function getAccessWelcomeNote(accessLevel: AccessLevel): string {
  if (accessLevel === 'superuser')
    return 'You have full access to Spotlight — manage the team and configure the system.'
  if (accessLevel === 'admin')
    return 'You have elevated access — manage the people in your department.'
  return 'You can report IT incidents, follow them through to resolution, and hear back when they’re fixed.'
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepWelcome({ employee, accessLevel, onNext }: { employee: EmployeeInfo; accessLevel: AccessLevel; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 mb-8 drop-shadow-lg" aria-hidden="true">
        <rect y="420.571" style={{ fill: '#3FA9F5' }} width="512" height="88.816" />
        <rect x="67.918" y="107.102" style={{ fill: '#f90000' }} width="125.388" height="36.571" />
        <path style={{ fill: '#E6E6E6' }} d="M193.306,54.857v52.245H67.918V54.857c0-5.747,4.702-10.449,10.449-10.449h52.245h52.245C188.604,44.408,193.306,49.11,193.306,54.857z" />
        <polygon style={{ fill: '#999999' }} points="193.306,143.673 224.653,143.673 224.653,175.02 193.306,175.02 67.918,175.02 36.571,175.02 36.571,143.673 67.918,143.673" />
        <rect x="67.918" y="211.592" style={{ fill: '#f90000' }} width="125.388" height="41.796" />
        <rect x="67.918" y="295.184" style={{ fill: '#f90000' }} width="125.388" height="41.796" />
        <polygon style={{ fill: '#E6E6E6' }} points="193.306,336.98 193.306,365.192 151.51,373.551 67.918,361.012 67.918,336.98" />
        <rect x="67.918" y="253.388" style={{ fill: '#E6E6E6' }} width="125.388" height="41.796" />
        <rect x="67.918" y="175.02" style={{ fill: '#E6E6E6' }} width="125.388" height="36.571" />
        <polygon style={{ fill: '#A67C52' }} points="193.306,365.192 229.878,357.878 334.367,420.571 20.898,420.571 47.02,357.878 67.918,361.012 151.51,373.551" />
        <path d="M336.538,412.735l-105.226-63.136l-30.168,6.033V182.857h31.347v-47.02h-31.347v-80.98c0-10.082-8.203-18.286-18.286-18.286h-44.408V2.612h-15.673v33.959H78.367c-10.082,0-18.286,8.203-18.286,18.286v80.98H28.735v47.02h31.347v169.055l-17.944-2.692l-26.464,63.514H0v15.673h512v-15.673H336.538z" />
      </svg>

      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 mb-2">Welcome to</p>
      <h1 className="text-4xl font-bold text-gray-900 mb-1">Spotlight</h1>
      <p className="text-lg text-gray-500 mb-10">
        Good to have you, <span className="font-semibold text-gray-800">{employee.first_name}</span>.
      </p>

      <div className="w-full max-w-sm bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-6 text-left">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-base font-semibold text-gray-900">{employee.first_name} {employee.last_name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{employee.designation ?? 'Team Member'}</p>
          </div>
          <span className="text-xs font-mono text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded-md">
            {employee.employee_code}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-gray-900 text-white px-2.5 py-1 rounded-full">
            {getAccessLabel(accessLevel)}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-10">
        {getAccessWelcomeNote(accessLevel)}
      </p>

      <button
        onClick={onNext}
        className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
      >
        Let&apos;s get started →
      </button>

      <p className="text-xs text-gray-300 mt-4">Takes about 2 minutes</p>
    </div>
  )
}

function StepFeatures({ accessLevel, onNext }: { accessLevel: AccessLevel; onNext: () => void }) {
  const sections = getFeatureSections(accessLevel)

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What you can do in Spotlight</h2>
        <p className="text-sm text-gray-400">
          Based on your access as <span className="font-medium text-gray-600">{getAccessLabel(accessLevel)}</span>
        </p>
      </div>

      <div className="space-y-6 mb-10">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-1">
              {section.title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {section.features.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 transition-colors"
                >
                  <span className="text-xl shrink-0 mt-0.5">{feature.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{feature.name}</p>
                    <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function StepPassword({ onNext }: { onNext: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setStatus('error'); setMessage('Passwords do not match.'); return }
    if (password.length < 8) { setStatus('error'); setMessage('Must be at least 8 characters.'); return }

    setStatus('loading')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('success')
      setTimeout(onNext, 800)
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
        <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Set your password</h2>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        You&apos;re currently on a temporary password. Choose something secure you&apos;ll remember.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 text-left">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm Password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
          />
        </div>

        {message && (
          <p className={`text-xs px-3 py-2 rounded-lg ${status === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {status === 'success' ? '✓ Password updated!' : message}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 mt-2"
        >
          {status === 'loading' ? 'Saving…' : status === 'success' ? '✓ Done' : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  )
}

function StepDone({ employee }: { employee: EmployeeInfo }) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">
        You&apos;re all set, {employee.first_name}!
      </h2>
      <p className="text-sm text-gray-400 mb-10 max-w-sm leading-relaxed">
        Welcome to the team. Spotlight is ready for you.
        Everything you need is in the sidebar — dive in whenever you&apos;re ready.
      </p>

      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 max-w-sm w-full mb-10 text-left">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick tips</p>
        <ul className="space-y-2.5">
          {[
            'Start by checking your Dashboard for an overview',
            'Log your attendance each day from the Attendance section',
            'Update your Profile if any details look off',
            'Reach out to your administrator for any access or role changes',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-gray-300 shrink-0 mt-0.5">→</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
      >
        Go to Dashboard →
      </button>
    </div>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-gray-900'
              : i < current
              ? 'w-2 h-2 bg-gray-300'
              : 'w-2 h-2 bg-gray-150 border border-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingClient({ employee, accessLevel, mustChangePassword }: OnboardingProps) {
  type StepId = 'welcome' | 'features' | 'password' | 'done'

  const steps: StepId[] = ['welcome', 'features']
  if (mustChangePassword) steps.push('password')
  steps.push('done')

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = steps[stepIndex]

  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1))

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Spotlight</span>
        </div>
        <Progress current={stepIndex} total={steps.length} />
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {currentStep === 'welcome' && (
            <StepWelcome employee={employee} accessLevel={accessLevel} onNext={next} />
          )}
          {currentStep === 'features' && (
            <StepFeatures accessLevel={accessLevel} onNext={next} />
          )}
          {currentStep === 'password' && (
            <StepPassword onNext={next} />
          )}
          {currentStep === 'done' && (
            <StepDone employee={employee} />
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-end">
        <p className="text-[10px] text-gray-300">
          Step {stepIndex + 1} of {steps.length}
        </p>
      </div>
    </div>
  )
}
