import { z } from 'zod'
import { defineCapability } from '../types'

// Read-only capabilities over the user's own notifications, through their own session client so
// Row-Level Security applies.

const anyEmployee = () => true

/** Supabase results become either the data or an error the model can relay. */
function out<T>(key: string, res: { data: T | null; error: { message: string } | null }) {
  return res.error ? { error: res.error.message } : { [key]: res.data ?? [] }
}

export const workspaceCapabilities = [
  defineCapability({
    name: 'list_my_notifications',
    module: 'Notifications',
    risk: 'read',
    description: "The user's recent notifications, newest first, with read/unread state.",
    skill: '`list_my_notifications`: good for "what do I need to look at?" Pair it with the lists below.',
    input: z.object({ unreadOnly: z.boolean().default(false), limit: z.number().int().min(1).max(50).default(15) }),
    allowed: anyEmployee,
    run: async (ctx, { unreadOnly, limit }) => {
      let q = ctx.supabase
        .from('notifications')
        .select('id, title, body, notification_type, is_read, created_at')
        .eq('recipient_id', ctx.employeeId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (unreadOnly) q = q.eq('is_read', false)
      return out('notifications', await q)
    },
  }),
]
