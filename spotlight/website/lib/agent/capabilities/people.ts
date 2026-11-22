import { z } from 'zod'
import { isAnyDeptAdmin } from '@/lib/access'
import { updateEmployee } from '@/app/(dashboard)/employees/actions'
import { defineCapability, type AgentContext } from '../types'
import { fields } from '../preview'

// People and personal settings: the employee directory (as the Employees page shows it), the
// user's own profile, notifications, and their Settings page. Reads go through the user's own
// session; writes through the same server actions and queries the pages use.

const anyEmployee = () => true
const directoryAccess = (ctx: AgentContext) => isAnyDeptAdmin(ctx.profile)

/** Browser-side changes the chat applies when a tool's result carries one (see home-chat). */
export type ClientEffect = { type: 'theme'; value: 'light' | 'dark' | 'system' } | { type: 'hideMascot'; value: boolean }

const name = (e: { first_name: string | null; last_name: string | null }) => `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()

export const peopleCapabilities = [
  defineCapability({
    name: 'list_employees',
    module: 'People',
    risk: 'read',
    description: 'The employee directory, as the Employees page shows it: names, roles, departments, contact details.',
    skill:
      '`list_employees`: look people up: who works where, someone\'s role, email or phone. Filter by `search` (name, email or designation) and `department`. Superusers see every organisation; department admins see their own.',
    input: z.object({
      search: z.string().max(100).nullable().default(null),
      department: z.string().max(100).nullable().default(null).describe('Department name, e.g. Engineering'),
      includeInactive: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    allowed: directoryAccess,
    run: async (ctx, { search, department, includeInactive, limit }) => {
      const { data: me } = await ctx.supabase.from('employees').select('org_id').eq('id', ctx.employeeId).single()
      let q = ctx.supabase
        .from('employees')
        .select('id, first_name, last_name, email, designation, phone, location, is_active, date_of_joining, employee_code')
        .is('deleted_at', null)
        .order('first_name')
      if (!ctx.profile.isSuperuser && me?.org_id) q = q.eq('org_id', me.org_id)
      if (!includeInactive) q = q.eq('is_active', true)
      if (search) {
        const s = search.replace(/[%,()]/g, ' ').trim()
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,designation.ilike.%${s}%`)
      }
      const { data: people, error } = await q
      if (error) return { error: error.message }

      const ids = (people ?? []).map((p) => p.id)
      const { data: roleRows } = ids.length
        ? await ctx.supabase
            .from('employee_roles')
            .select('employee_id, roles(title, access_level, departments(name))')
            .in('employee_id', ids)
            .eq('is_active', true)
        : { data: [] }
      const roles = new Map<string, { title: string; level: string; department: string | null }[]>()
      for (const r of roleRows ?? []) {
        const role = (Array.isArray(r.roles) ? r.roles[0] : r.roles) as
          | { title: string; access_level: string; departments: { name: string } | { name: string }[] | null }
          | null
        if (!role) continue
        const dept = Array.isArray(role.departments) ? role.departments[0]?.name : role.departments?.name
        roles.set(r.employee_id, [...(roles.get(r.employee_id) ?? []), { title: role.title, level: role.access_level, department: dept ?? null }])
      }

      const rows = (people ?? [])
        .map((p) => ({
          id: p.id,
          name: name(p),
          email: p.email,
          code: p.employee_code,
          designation: p.designation,
          phone: p.phone,
          location: p.location,
          joined: p.date_of_joining,
          active: p.is_active,
          roles: (roles.get(p.id) ?? []).map((r) => `${r.title}${r.department ? ` (${r.department})` : ''}`),
          departments: [...new Set((roles.get(p.id) ?? []).map((r) => r.department).filter(Boolean))],
        }))
        .filter((p) => !department || p.departments.some((d) => d!.toLowerCase().includes(department.toLowerCase())))
      return { count: rows.length, employees: rows.slice(0, limit), link: '/employees' }
    },
  }),

  defineCapability({
    name: 'list_departments',
    module: 'People',
    risk: 'read',
    description: "The organisation's departments, with their ids.",
    skill: '`list_departments`: department names and ids, for anything that asks for one.',
    input: z.object({}),
    allowed: anyEmployee,
    run: async (ctx) => {
      const { data, error } = await ctx.supabase.from('departments').select('id, name').eq('is_active', true).order('name')
      return error ? { error: error.message } : { departments: data ?? [] }
    },
  }),

  defineCapability({
    name: 'get_my_profile',
    module: 'People',
    risk: 'read',
    description: "The user's own profile: name, contact details, designation, roles, emergency contact.",
    skill: '`get_my_profile`: what the user\'s profile says about them (the Profile page).',
    input: z.object({}),
    allowed: anyEmployee,
    run: async (ctx) => {
      const [{ data: me, error }, { data: extra }] = await Promise.all([
        ctx.supabase
          .from('employees')
          .select('first_name, last_name, email, employee_code, designation, phone, location, timezone, date_of_joining, date_of_birth, is_active')
          .eq('id', ctx.employeeId)
          .single(),
        ctx.supabase.from('employee_profiles').select('emergency_contact_name, emergency_contact_phone').eq('employee_id', ctx.employeeId).maybeSingle(),
      ])
      if (error) return { error: error.message }
      return { ...me, ...(extra ?? {}), roles: ctx.roleSummary, link: '/profile' }
    },
  }),

  defineCapability({
    name: 'update_my_profile',
    module: 'People',
    risk: 'write',
    description: "Updates the user's own profile details. Only the fields given change.",
    skill:
      '`update_my_profile`: change the user\'s phone, location, timezone, designation, dates or emergency contact, as the Edit button on Profile does. Pass only the fields they want changed. Bank details and passwords are changed on the Profile page itself, never through chat.',
    input: z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      designation: z.string().max(100).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      location: z.string().max(100).nullable().optional(),
      timezone: z.string().max(60).nullable().optional().describe('IANA zone, e.g. Asia/Kolkata'),
      dateOfJoining: z.string().nullable().optional().describe('YYYY-MM-DD'),
      dateOfBirth: z.string().nullable().optional().describe('YYYY-MM-DD'),
      emergencyContactName: z.string().max(100).nullable().optional(),
      emergencyContactPhone: z.string().max(40).nullable().optional(),
    }),
    allowed: anyEmployee,
    preview: (i) => ({
      kind: 'request',
      title: 'Update your profile',
      done: 'Profile updated',
      fields: fields(
        ['First name', i.firstName],
        ['Last name', i.lastName],
        ['Designation', i.designation],
        ['Phone', i.phone],
        ['Location', i.location],
        ['Timezone', i.timezone],
        ['Joined', i.dateOfJoining],
        ['Born', i.dateOfBirth],
        ['Emergency contact', i.emergencyContactName],
        ['Emergency phone', i.emergencyContactPhone]
      ),
    }),
    run: async (ctx, i) => {
      const [{ data: me }, { data: extra }] = await Promise.all([
        ctx.supabase.from('employees').select('first_name, last_name, designation, phone, location, timezone, date_of_joining, date_of_birth').eq('id', ctx.employeeId).single(),
        ctx.supabase.from('employee_profiles').select('emergency_contact_name, emergency_contact_phone').eq('employee_id', ctx.employeeId).maybeSingle(),
      ])
      if (!me) return { error: 'Your profile could not be found.' }
      const pick = <T,>(next: T | undefined, current: T) => (next === undefined ? current : next)
      const res = await updateEmployee({
        id: ctx.employeeId,
        first_name: pick(i.firstName, me.first_name),
        last_name: pick(i.lastName, me.last_name),
        designation: pick(i.designation, me.designation),
        phone: pick(i.phone, me.phone),
        location: pick(i.location, me.location),
        timezone: pick(i.timezone, me.timezone),
        date_of_joining: pick(i.dateOfJoining, me.date_of_joining),
        date_of_birth: pick(i.dateOfBirth, me.date_of_birth),
        emergency_contact_name: pick(i.emergencyContactName, extra?.emergency_contact_name ?? null),
        emergency_contact_phone: pick(i.emergencyContactPhone, extra?.emergency_contact_phone ?? null),
      })
      return res.ok ? { updated: true, link: '/profile' } : { error: res.error }
    },
  }),

  defineCapability({
    name: 'mark_notifications_read',
    module: 'Notifications',
    risk: 'write',
    description: "Marks the user's notifications as read: specific ones, or all of them.",
    skill: '`mark_notifications_read`: clear the bell. Pass `ids` from `list_my_notifications`, or `all: true`.',
    input: z.object({ ids: z.array(z.string().uuid()).max(100).default([]), all: z.boolean().default(false) }),
    allowed: anyEmployee,
    preview: (i) => ({
      kind: 'review',
      title: i.all ? 'Mark all notifications read' : `Mark ${i.ids.length} notification${i.ids.length === 1 ? '' : 's'} read`,
      done: 'Notifications marked read',
      fields: [],
    }),
    run: async (ctx, { ids, all }) => {
      if (!all && ids.length === 0) return { error: 'Say which notifications, or all.' }
      let q = ctx.supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('recipient_id', ctx.employeeId).eq('is_read', false)
      if (!all) q = q.in('id', ids)
      const { data, error } = await q.select('id')
      return error ? { error: error.message } : { marked: data?.length ?? 0 }
    },
  }),

  defineCapability({
    name: 'set_theme',
    module: 'Your settings',
    risk: 'write',
    description: 'Switches Spotlight between light, dark, or matching the device, in this browser.',
    skill: '`set_theme`: the Appearance setting on the Settings page. It applies to the browser they are using now.',
    input: z.object({ theme: z.enum(['light', 'dark', 'system']) }),
    allowed: anyEmployee,
    preview: ({ theme }) => ({
      kind: 'review',
      title: 'Change the theme',
      done: 'Theme changed',
      fields: fields(['Theme', theme === 'system' ? 'Match system' : theme === 'dark' ? 'Dark' : 'Light', true]),
    }),
    run: async (_ctx, { theme }) => ({ applied: true, clientEffect: { type: 'theme', value: theme } satisfies ClientEffect }),
  }),

  defineCapability({
    name: 'set_mascot_hidden',
    module: 'Your settings',
    risk: 'write',
    description: "Hides or shows the Mariner turtle on the message box (the user's Settings).",
    skill: '`set_mascot_hidden`: the "Hide Mariner mascot" switch on the Settings page. Saved on their account.',
    input: z.object({ hidden: z.boolean() }),
    allowed: anyEmployee,
    preview: ({ hidden }) => ({
      kind: 'review',
      title: hidden ? 'Hide the Mariner mascot' : 'Show the Mariner mascot',
      done: hidden ? 'Mascot hidden' : 'Mascot shown',
      fields: [],
    }),
    run: async (ctx, { hidden }) => {
      const { error } = await ctx.supabase.auth.updateUser({ data: { hide_mascot: hidden } })
      if (error) return { error: error.message }
      return { applied: true, clientEffect: { type: 'hideMascot', value: hidden } satisfies ClientEffect }
    },
  }),
]
