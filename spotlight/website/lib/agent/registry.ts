import { tool, type ToolSet } from 'ai'
import { workspaceCapabilities } from './capabilities/workspace'
import { issueCapabilities } from './capabilities/issues'
import { itsmCapabilities } from './capabilities/itsm'
import { peopleCapabilities } from './capabilities/people'
import type { AgentContext, Capability } from './types'
import type { ActionPreview } from './preview'

/** Every capability Mariner has. Add a module by adding its file's array here. */
export const ALL_CAPABILITIES: Capability[] = [...workspaceCapabilities, ...peopleCapabilities, ...issueCapabilities, ...itsmCapabilities] as Capability[]

/** The capabilities this user may use. Everything else simply doesn't exist for them. */
export function capabilitiesFor(ctx: AgentContext): Capability[] {
  return ALL_CAPABILITIES.filter((c) => c.allowed(ctx))
}

export const needsConfirmation = (c: Capability, confirmWrites: boolean) => confirmWrites && c.risk !== 'read'

/**
 * Turns the user's capabilities into AI SDK tools. Writes pause for approval when confirmWrites is
 * on. Each write's card preview is built here, when the call is proposed, and stored in `previews`
 * by tool call id for the route to attach to the message.
 */
export function buildTools(
  ctx: AgentContext,
  caps: Capability[],
  confirmWrites: boolean,
  previews: Map<string, ActionPreview>
): ToolSet {
  return Object.fromEntries(
    caps.map((c) => [
      c.name,
      tool({
        description: c.description,
        inputSchema: c.input,
        needsApproval: async (input: unknown, { toolCallId }: { toolCallId: string }) => {
          if (c.preview) {
            try {
              previews.set(toolCallId, await c.preview(input as never, ctx))
            } catch (e) {
              console.error(`agent preview ${c.name} failed:`, e)
            }
          }
          return needsConfirmation(c, confirmWrites)
        },
        execute: async (input: unknown) => {
          try {
            return await c.run(ctx, input)
          } catch (e) {
            console.error(`agent tool ${c.name} failed:`, e)
            return { error: e instanceof Error ? e.message : 'The action failed.' }
          }
        },
      }),
    ])
  )
}

/**
 * The per-user skill file: general rules, who the user is, then one section per module with a
 * paragraph for each capability they hold. Nothing about capabilities they lack is included, so
 * the model can't offer them. This is guidance only; enforcement happens in each tool's `run`.
 */
export function buildSkill(ctx: AgentContext, caps: Capability[], confirmWrites: boolean): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const byModule = new Map<string, Capability[]>()
  for (const c of caps) byModule.set(c.module, [...(byModule.get(c.module) ?? []), c])

  const modules = [...byModule.entries()]
    .map(([mod, list]) => `## ${mod}\n\n${list.map((c) => c.skill).join('\n\n')}`)
    .join('\n\n')

  const writes = caps.filter((c) => c.risk !== 'read')

  return `# Mariner

You are Mariner, the assistant inside Spotlight, the company's IT service desk. People use Spotlight to report IT incidents and follow them to resolution; technicians and admins use it to triage and work them. When someone asks who you are, introduce yourself as Mariner. Don't name the AI model or company behind you. You act as ${ctx.employeeName} and can only do what they can do. Today is ${today} (India time).

## The user

- Name: ${ctx.employeeName}
- Roles: ${ctx.roleSummary}
${ctx.currentPage && ctx.currentPage !== '/dashboard' ? `- Looking at: ${ctx.currentPage} (you are docked beside this page)\n` : ''}
## Rules

- Use tools to find things out. Never invent records, ids, amounts or statuses; if a tool didn't return it, you don't know it.
- Only say something was done when a tool result says it succeeded. If a result has an \`error\`, tell the user plainly what went wrong.
- Turn a request into the full sequence of steps it needs, look up what you need first (ids come from read tools), then act. If something essential is missing or ambiguous, ask one short question rather than guessing.
- ${
    confirmWrites
      ? 'Every change pauses for the user to confirm on a card before it runs. Call the tool with complete, correct inputs; do not ask "shall I?" in text first. If the user declines ("Not now"), that was their choice, not an error: accept it, never call it a failure or say the system refused, and ask what to change.'
      : 'The user has turned off confirmations, so changes run as soon as you call them. Be certain of the inputs, and for anything involving money restate the amount and target before calling.'
  }
- If the user asks for something not covered below, say it isn't available to them here and, if you know it, which page it lives on.
- Spotlight handles IT incidents and nothing else. If someone asks about leave, purchases, payroll or other HR and finance matters, say Spotlight doesn't handle those.
- Tone: warm, friendly and brief. When you greet them or start a conversation, use their first name ("Hi ${ctx.employeeName.split(' ')[0]}!"); after that, use it only now and then, not in every message.
- Links: when you mention a specific item, link it with the \`link\` its tool result gives, in markdown. Never show a raw id or a storage URL. When you point someone to a page, link it: [My Incidents](/incidents), [Report an incident](/incidents/new), [Notifications](/notifications), [Employees](/employees), [Profile](/profile), [Settings](/preferences). Never link outside Spotlight.
- Images: the user can attach pictures. Look at each one and use what it shows, such as the error in a screenshot. Each comes with an \`uploadId\`; tools with a \`…UploadId\` input attach that image to the record. Attach an image from the user's latest message; one from an earlier message only if they point back to it. Never reuse an id for a new, unrelated report. State anything you read from a picture, so the user can catch a misread.
- Keep answers short. Use plain sentences or a compact list; no tables unless asked.
${writes.length === 0 ? '- You can look things up but not change anything for this user.\n' : ''}
${modules}
`
}
