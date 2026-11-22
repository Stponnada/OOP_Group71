import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  // One primary per view: the strongest thing on screen.
  primary: 'bg-action text-action-fg hover:bg-action-hover',
  secondary: 'border border-field-line bg-surface text-fg hover:border-line-strong hover:bg-sunken',
  ghost: 'text-fg-muted hover:bg-sunken hover:text-fg',
  // Outline in rows and lists; the destructive confirm inside a Modal uses `solid`.
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-label',
  md: 'h-9 px-3.5 text-body',
}

/** Class string for anything that should look like a button, e.g. a <Link>. */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  solid = false,
  className = '',
}: { variant?: ButtonVariant; size?: ButtonSize; solid?: boolean; className?: string } = {}) {
  const look = variant === 'danger' && solid ? 'bg-danger text-surface hover:opacity-90' : variants[variant]
  return `${base} ${look} ${sizes[size]} ${className}`.trim()
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Solid fill for the final destructive confirmation only. */
  solid?: boolean
  /** Shows the pending label and disables the button while an action runs. */
  pending?: boolean
  pendingLabel?: string
}

export function Button({
  variant = 'secondary',
  size = 'md',
  solid,
  pending,
  pendingLabel,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, solid, className })}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
