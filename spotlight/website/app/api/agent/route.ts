import { createAnthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { after } from 'next/server'
import { consumeStream, convertToModelMessages, createIdGenerator, stepCountIs, streamText, type UIMessage } from 'ai'
import { getAgentContext } from '@/lib/agent/context'
import { chatHasTitle, firstUserText, isChatId, nameChat, saveChat } from '@/lib/agent/chats'
import type { ActionPreview } from '@/lib/agent/preview'
import { buildSkill, buildTools, capabilitiesFor } from '@/lib/agent/registry'
import { cleanPagePath } from '@/lib/issue-status'
import { withUploadsForModel } from '@/lib/agent/uploads'

// A workflow can take several tool calls (look up, then act, then confirm the result).
export const maxDuration = 60

// The model is chosen by the deployment, never by the user.
// - opencode (default): opencode Zen with OPENCODE_API_KEY. Claude models speak the Anthropic
//   Messages API under /inference/anthropic; the rest (e.g. muse-spark-1.3) speak the OpenAI
//   Responses API under /inference/openai. Zen's free models only work inside the OpenCode app.
// - google: Gemini with GOOGLE_GENERATIVE_AI_API_KEY (default gemini-3.5-flash-lite).
const PROVIDER = process.env.SPOTLIGHT_AGENT_PROVIDER === 'google' ? 'google' : 'opencode'
const MODEL_ID =
  process.env.SPOTLIGHT_AGENT_MODEL ?? (PROVIDER === 'google' ? 'gemini-3.5-flash-lite' : 'muse-spark-1.3')

function getModel() {
  if (PROVIDER === 'google') return google(MODEL_ID)
  if (MODEL_ID.startsWith('claude-')) {
    return createAnthropic({
      baseURL: 'https://opencode.ai/inference/anthropic/v1',
      authToken: process.env.OPENCODE_API_KEY,
    })(MODEL_ID)
  }
  return createOpenAI({ baseURL: 'https://opencode.ai/inference/openai/v1', apiKey: process.env.OPENCODE_API_KEY }).responses(
    MODEL_ID
  )
}

// Zen doesn't keep conversation state, so reasoning travels with the messages instead of by id.
const providerOptions = { openai: { store: false, include: ['reasoning.encrypted_content'] } }

export type AgentMessageMetadata = {
  /** How each write call should look on its confirmation card, keyed by tool call id. */
  previews?: Record<string, ActionPreview>
}

export async function POST(req: Request) {
  const keyName = PROVIDER === 'google' ? 'GOOGLE_GENERATIVE_AI_API_KEY' : 'OPENCODE_API_KEY'
  if (!process.env[keyName]) {
    return Response.json({ error: `The assistant is not configured (${keyName} is missing).` }, { status: 503 })
  }

  const {
    id: chatId,
    messages,
    confirmWrites = true,
    pagePath,
  }: { id?: string; messages: UIMessage[]; confirmWrites?: boolean; pagePath?: unknown } = await req.json()

  const ctx = await getAgentContext(cleanPagePath(pagePath))
  if (!ctx) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (!isChatId(chatId)) return Response.json({ error: 'Bad chat id' }, { status: 400 })

  // A new chat gets its name from a separate small call that runs alongside the answer.
  const title = (await chatHasTitle(ctx, chatId)) ? null : nameChat(getModel(), firstUserText(messages), providerOptions)
  // The chat is saved when the answer finishes; after() keeps the request alive until it is.
  let saved!: () => void
  after(
    Promise.race([
      new Promise<void>((resolve) => (saved = resolve)),
      // If the stream dies without finishing, don't hold the function open past its limit.
      new Promise<void>((resolve) => setTimeout(resolve, maxDuration * 1000)),
    ])
  )

  // Rebuilt on every request from the signed-in session, so a change of role takes effect on the
  // next message and nothing the client sends can widen what the user is allowed to do.
  const caps = capabilitiesFor(ctx)
  const confirm = confirmWrites !== false
  const previews = new Map<string, ActionPreview>()
  const modelMessages = await convertToModelMessages(await withUploadsForModel(ctx, messages))
  const system = buildSkill(ctx, caps, confirm)

  const result = streamText({
    model: getModel(),
    system,
    messages: modelMessages,
    tools: buildTools(ctx, caps, confirm, previews),
    stopWhen: stepCountIs(12),
    providerOptions,
  })

  return result.toUIMessageStreamResponse<UIMessage<AgentMessageMetadata>>({
    originalMessages: messages as UIMessage<AgentMessageMetadata>[],
    // Stored chats need real ids on the assistant's messages too (otherwise they're saved as '').
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
    // Keep generating (and saving) even if the browser goes away mid-answer.
    consumeSseStream: consumeStream,
    onFinish: async ({ messages: finished }) => {
      try {
        await saveChat(ctx, chatId, finished, title ? await title : null)
      } finally {
        saved()
      }
    },
    // Previews are built while the call is proposed (see buildTools); attach each one to the message
    // as soon as its approval request (or, with confirmations off, its result) goes out.
    messageMetadata: ({ part }) => {
      const id =
        part.type === 'tool-approval-request' ? part.toolCall.toolCallId
        : part.type === 'tool-result' || part.type === 'tool-error' ? part.toolCallId
        : null
      const preview = id ? previews.get(id) : undefined
      if (!id || !preview) return undefined
      previews.delete(id)
      return { previews: { [id]: preview } }
    },
    onError: (e) => {
      console.error('agent stream failed:', e)
      const status = (e as { statusCode?: number }).statusCode
      if (status === 402) return 'The assistant is out of credit with its model provider. Ask an admin to top up the account.'
      if (status === 401 || status === 403) return 'The assistant could not sign in to its model provider. Check its API key.'
      if (status === 429) return 'The assistant is busy right now. Try again in a minute.'
      return 'Something went wrong talking to the model. Try again in a moment.'
    },
  })
}
