'use client'

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type ComponentProps,
} from 'react'

// Width is applied separately: Tailwind v4 orders same-property utilities by name, so a
// caller's `w-24` would lose to a built-in `w-full`. Pass any `w-*` class to override.
const width = (className: string) => (/(^|\s)!?(max-)?w-/.test(className) ? '' : 'w-full')

export const controlClass =
  // Filled, quiet fields: the edge is faint at rest, stronger on hover, and the focus ring marks the active one.
  'rounded-md border border-field-line bg-field px-3 py-2 text-body text-fg transition-colors ' +
  'hover:border-line-strong placeholder:text-fg-subtle focus:border-focus focus:outline-2 focus:outline-offset-0 focus:outline-focus/30 ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-subtle aria-[invalid=true]:border-danger'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${width(className)} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${width(className)} pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea className={`${controlClass} ${width(className)} ${className}`} {...props} />
}

type FieldProps = {
  label: ReactNode
  /** One control (Input, Select, Textarea or any element that accepts id/aria-*). */
  children: ReactElement
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
}

/**
 * Label + control + hint/error, correctly associated: the label's htmlFor points at the
 * control, hint and error are wired through aria-describedby, and errors set aria-invalid.
 * Pass an explicit `id` on the child to keep an existing id.
 */
export function Field({ label, children, hint, error, required, className = '' }: FieldProps) {
  const autoId = useId()
  const child = Children.only(children)
  const childProps = (isValidElement(child) ? child.props : {}) as Record<string, unknown>
  const id = (childProps.id as string | undefined) ?? autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [childProps['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = cloneElement(child as ReactElement<Record<string, unknown>>, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : childProps['aria-invalid'],
    required: required ?? childProps.required,
  })

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-label font-medium text-fg-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-label text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-label text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Form-level message: errors are announced (role="alert"), successes politely (role="status"). */
export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  if (!children) return null
  return tone === 'error' ? (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-body text-success">
      {children}
    </p>
  )
}
