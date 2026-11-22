import { generateText, type LanguageModel, type UIMessage } from 'ai'
import type { AgentContext } from './types'

// Chats are stored with the user's own session client: the agent_chats RLS policies make every
// read and write own-only, so a forged chat id can't touch someone else's conversation.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isChatId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)

export async function chatHasTitle(ctx: AgentContext, id: string) {
  const { data } = await ctx.supabase.from('agent_chats').select('title').eq('id', id).maybeSingle()
  return !!data?.title
}

export async function saveChat(ctx: AgentContext, id: string, messages: UIMessage[], title?: string | null) {
  const { error } = await ctx.supabase.from('agent_chats').upsert({
    id,
    employee_id: ctx.employeeId,
    messages,
    updated_at: new Date().toISOString(),
    ...(title && { title }),
  })
  if (error) console.error('agent chat save failed:', error.message)
}

export function firstUserText(messages: UIMessage[]) {
  const first = messages.find((m) => m.role === 'user')
  return first?.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim() ?? ''
}

/** A separate, tiny model call: a few words naming the chat from its first message. */
export async function nameChat(model: LanguageModel, firstMessage: string, providerOptions?: object): Promise<string> {
  const fallback = firstMessage.split(/\s+/).slice(0, 6).join(' ')
  try {
    const { text } = await generateText({
      model,
      system:
        'You name chats in a company operations app. Reply with only a title of 2 to 5 words, in sentence case, ' +
        'that says what the person wants. No quotes, no trailing punctuation, no emoji.',
      prompt: firstMessage.slice(0, 1000),
      providerOptions: providerOptions as never,
    })
    const title = text.trim().split('\n')[0].replace(/^["'“”]+|["'“”.]+$/g, '').trim()
    return (title || fallback).slice(0, 60)
  } catch (e) {
    console.error('agent chat naming failed:', e)
    return fallback.slice(0, 60)
  }
}
