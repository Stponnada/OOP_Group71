'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type AssistantFormField = {
  name: string
  label: string
  type: 'text' | 'email' | 'select' | 'number'
  required?: boolean
  value?: string
  options?: Array<{ value: string; label: string }>
}

export type AssistantFormSnapshot = {
  id: string
  title: string
  path?: string
  fields: AssistantFormField[]
}

type RegisteredForm = AssistantFormSnapshot & {
  applyPatch: (patch: Record<string, string>) => void
}

type AssistantContextValue = {
  activeForm: AssistantFormSnapshot | null
  registerForm: (form: RegisteredForm) => void
  unregisterForm: (formId: string) => void
  applyToolOutput: (output: unknown) => boolean
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

function toPatch(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object') return null
  const patch = (value as { patch?: unknown }).patch
  if (!patch || typeof patch !== 'object') return null

  return Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [registeredForm, setRegisteredForm] = useState<RegisteredForm | null>(null)

  const registerForm = useCallback((form: RegisteredForm) => {
    setRegisteredForm(form)
  }, [])

  const unregisterForm = useCallback((formId: string) => {
    setRegisteredForm((current) => (current?.id === formId ? null : current))
  }, [])

  const applyToolOutput = useCallback((output: unknown) => {
    if (!registeredForm || !output || typeof output !== 'object') return false

    const targetFormId = (output as { targetFormId?: unknown }).targetFormId
    if (targetFormId !== registeredForm.id) return false

    const patch = toPatch(output)
    if (!patch) return false

    registeredForm.applyPatch(patch)
    return true
  }, [registeredForm])

  const activeForm = useMemo<AssistantFormSnapshot | null>(() => {
    if (!registeredForm) return null
    const snapshot: AssistantFormSnapshot = {
      id: registeredForm.id,
      title: registeredForm.title,
      path: registeredForm.path,
      fields: registeredForm.fields,
    }
    return snapshot
  }, [registeredForm])

  const value = useMemo(
    () => ({
      activeForm,
      registerForm,
      unregisterForm,
      applyToolOutput,
    }),
    [activeForm, applyToolOutput, registerForm, unregisterForm],
  )

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const value = useContext(AssistantContext)
  if (!value) {
    throw new Error('useAssistant must be used inside AssistantProvider')
  }
  return value
}
