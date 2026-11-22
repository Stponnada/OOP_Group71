import type { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccessLevel, AccessProfile } from '@/lib/access'
import type { ActionPreview } from './preview'

/**
 * Who is asking, resolved once per request from the signed-in session. Capabilities use it
 * to decide whether the user may use them (`allowed`) and to run as that user (`run`).
 */
export type AgentContext = {
  employeeId: string
  /** The Supabase auth user id: the user's folder in storage. */
  authUserId: string
  employeeName: string
  /** The user's own session client: queries go through Row-Level Security as that user. */
  supabase: SupabaseClient
  profile: AccessProfile
  /** Flat level used by leave, attendance and content pages ('superuser' = Executive / system admin). */
  accessLevel: AccessLevel
  /** Superuser in Engineering: sees and works the issues people report. */
  isEngineeringSuperuser: boolean
  /** The in-app page the user is on (e.g. /incidents/…), when the browser said. */
  currentPage: string | null
  /** Human-readable summary of the user's roles, for the skill file. */
  roleSummary: string
}

/**
 * - read:      looks things up, changes nothing. Never needs confirmation.
 * - write:     creates or changes a record (submit, update, mark received).
 * - financial: approves, pays, or otherwise commits money; also destructive changes.
 */
export type Risk = 'read' | 'write' | 'financial'

/**
 * One thing the agent can do. A capability file is the single source for:
 *   - who may use it (`allowed`), which decides both whether the tool exists for this user and
 *     whether its paragraph appears in the user's skill file;
 *   - what it does and when to use it (`skill`), stitched into the per-user skill file;
 *   - the input it takes (`input`, a zod schema the model must satisfy);
 *   - how it runs (`run`), which must go through the existing server actions or the user's
 *     RLS-bound client. `allowed` is a convenience filter, never the security boundary: `run`
 *     must not do anything the user couldn't do in the UI.
 */
export type Capability<I extends z.ZodType = z.ZodType> = {
  /** Tool name the model calls: snake_case, verb first. */
  name: string
  /** Module heading the paragraph is grouped under in the skill file. */
  module: string
  risk: Risk
  /** One sentence for the tool description shown to the model. */
  description: string
  /** Paragraph(s) for the skill file: when to use it, what to ask the user first, gotchas. */
  skill: string
  input: I
  allowed: (ctx: AgentContext) => boolean
  run: (ctx: AgentContext, input: z.infer<I>) => Promise<unknown>
  /**
   * For writes: what will happen, laid out for the confirmation card. No ids. May look things up
   * (e.g. which order an order id is) so the card names the record from the database rather than
   * from the model's description of it.
   */
  preview?: (input: z.infer<I>, ctx: AgentContext) => ActionPreview | Promise<ActionPreview>
}

/** Helper so each capability file gets full type inference on `input`. */
export function defineCapability<I extends z.ZodType>(c: Capability<I>): Capability<I> {
  return c
}
