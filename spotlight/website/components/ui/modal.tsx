'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Buttons, right-aligned. Put the primary (or solid danger) action last. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** false = only an explicit button can close it (no Escape, backdrop or ×), e.g. while a one-time secret is shown. */
  dismissible?: boolean
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }

/**
 * Built on the native <dialog> with showModal(): focus is trapped, Escape closes,
 * the rest of the page is inert, and focus returns to the element that opened it.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => {
      returnFocus.current?.focus?.()
      if (open) onClose()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [open, onClose])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Escape fires `cancel`; block it when the dialog must not be dismissed.
        if (!dismissible) e.preventDefault()
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes.
        if (dismissible && e.target === ref.current) onClose()
      }}
      className={`w-[calc(100%-2rem)] ${widths[size]} rounded-md border border-line bg-surface p-0 text-fg backdrop:bg-scrim m-auto`}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-h2 font-medium text-fg">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-body text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-fg-subtle hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X size={16} aria-hidden="true" />
            </button>
            )}
          </div>
          {children}
          {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** A confirmation for destructive or financial actions. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = true,
  pending,
  cancelLabel = 'Cancel',
  children,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  /** e.g. "Keep request" when the confirm action is itself a cancellation. */
  cancelLabel?: string
  /** Optional extra content, e.g. a reason field. */
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border border-line-strong px-3.5 text-body font-medium text-fg hover:bg-sunken"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex h-9 items-center rounded-md px-3.5 text-body font-medium disabled:opacity-50 ${
              danger ? 'bg-danger text-surface hover:opacity-90' : 'bg-action text-action-fg hover:bg-action-hover'
            }`}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
