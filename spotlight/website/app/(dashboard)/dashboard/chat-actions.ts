'use server'

import type { UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { isChatId } from '@/lib/agent/chats'

// The session client is enough: agent_chats RLS only ever returns the caller's own chats.

export type ChatSummary = { id: string; title: string | null; updatedAt: string }

export async function listChats(): Promise<ChatSummary[] | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_chats')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return { error: 'Could not load your chats.' }
  return (data ?? []).map((c) => ({ id: c.id as string, title: c.title as string | null, updatedAt: c.updated_at as string }))
}

export async function loadChat(id: string): Promise<{ title: string | null; messages: UIMessage[] } | { error: string }> {
  if (!isChatId(id)) return { error: 'Chat not found.' }
  const supabase = await createClient()
  const { data } = await supabase.from('agent_chats').select('title, messages').eq('id', id).maybeSingle()
  if (!data) return { error: 'Chat not found.' }
  return { title: data.title as string | null, messages: data.messages as UIMessage[] }
}

export async function getChatTitle(id: string): Promise<string | null> {
  if (!isChatId(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from('agent_chats').select('title').eq('id', id).maybeSingle()
  return (data?.title as string | null) ?? null
}

export async function deleteChat(id: string): Promise<{ success: true } | { error: string }> {
  if (!isChatId(id)) return { error: 'Chat not found.' }
  const supabase = await createClient()
  const { error } = await supabase.from('agent_chats').delete().eq('id', id)
  return error ? { error: 'Could not delete the chat.' } : { success: true }
}
