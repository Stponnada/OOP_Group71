'use client'

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
  type UIMessage,
} from 'ai'
import {
  ArrowUp,
  Banknote,
  CreditCard,
  Boxes,
  Bell,
  Bug,
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  ClipboardCheck,
  History,
  ImagePlus,
  Loader2,
  Maximize2,
  MapPin,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingCart,
  Square,
  Stamp,
  Trash2,
  Truck,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { AgentMessageMetadata } from '@/app/api/agent/route'
import type { ActionPreview } from '@/lib/agent/preview'
import { Button } from '@/components/ui'
import { useMarinerDock } from '@/components/assistant/mariner-dock-context'
import { MarinerMascot } from '@/components/assistant/mariner-mascot'
import { usePreferences } from '@/components/preferences-context'
import { applyTheme } from '@/lib/theme'
import type { ClientEffect } from '@/lib/agent/capabilities/people'
import { ACCEPTED_IMAGES, uploadImage, useUploadSrc } from '@/components/assistant/mariner-uploads'
import { MAX_IMAGES_PER_MESSAGE, UPLOAD_SCHEME, uploadIdFromUrl } from '@/lib/agent/upload-ref'
import { deleteChat, getChatTitle, listChats, loadChat, type ChatSummary } from './chat-actions'
import DashboardGreeting, { GreetingNameContext } from './dashboard-greeting'

type Message = UIMessage<AgentMessageMetadata>

const CONFIRM_KEY = 'spotlight.agent.confirmWrites'

// Read by the transport on every request, including the automatic resend after a confirmation.
let confirmWritesSetting = true
const transport = new DefaultChatTransport<Message>({
  api: '/api/agent',
  // The page you're on, so Mariner knows what "this page" means when docked beside it.
  body: () => ({ confirmWrites: confirmWritesSetting, pagePath: `${window.location.pathname}${window.location.search}` }),
})

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: 'What needs my attention today?', icon: Bell },
  { text: 'Where are my open incidents?', icon: ClipboardCheck },
  { text: 'Report that the VPN keeps disconnecting', icon: Bug },
]

type OpenChat = { id: string; title: string | null; messages: Message[] }

function showInUrl(chatId: string | null) {
  const url = new URL(window.location.href)
  if (chatId) url.searchParams.set('chat', chatId)
  else url.searchParams.delete('chat')
  window.history.replaceState(window.history.state, '', url)
}

const newChat = (): OpenChat => ({ id: crypto.randomUUID(), title: null, messages: [] })

/**
 * The home page: conversations with an agent that acts as the signed-in employee. This shell
 * knows which chat is open (mirrored in ?chat= so a reload or a link reopens it); the chat
 * itself remounts whenever that changes.
 */
export default function HomeChat({ firstName }: { firstName: string | null }) {
  const [chat, setChat] = useState<OpenChat | null>(null)

  // On first load, reopen the chat in the URL if there is one.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('chat')
    if (!id) {
      setChat(newChat()) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    loadChat(id).then((res) => setChat('error' in res ? newChat() : { id, title: res.title, messages: res.messages as Message[] }))
  }, [])

  function open(next: OpenChat) {
    setChat(next)
    showInUrl(next.messages.length > 0 ? next.id : null)
  }

  async function openFromHistory(id: string) {
    const res = await loadChat(id)
    if (!('error' in res)) open({ id, title: res.title, messages: res.messages as Message[] })
  }

  if (!chat) return null
  return (
    <GreetingNameContext.Provider value={firstName}>
      <Conversation
        key={chat.id}
        chat={chat}
        onNewChat={() => open(newChat())}
        onOpenChat={openFromHistory}
        onStarted={() => showInUrl(chat.id)}
      />
    </GreetingNameContext.Provider>
  )
}

/** Where a link in the chat goes: the page variant docks the chat first, the dock just navigates. */
const NavigateContext = createContext<(href: string) => void>(() => {})

function Conversation({
  chat,
  variant = 'page',
  onNewChat,
  onOpenChat,
  onStarted,
  onExpand,
  onClose,
}: {
  chat: OpenChat
  /** The home page, or docked beside another page after following a link. */
  variant?: 'page' | 'dock'
  onNewChat?: () => void
  onOpenChat?: (id: string) => void
  /** The first message went out: the chat now exists and belongs in the URL. */
  onStarted?: () => void
  onExpand?: () => void
  onClose?: () => void
}) {
  const router = useRouter()
  const { dock: dockChat } = useMarinerDock()
  const navigate = (href: string) => {
    if (variant === 'page') dockChat(chat.id)
    router.push(href)
  }

  const [confirmWrites, setConfirmWrites] = useConfirmWrites()
  useEffect(() => {
    confirmWritesSetting = confirmWrites
  }, [confirmWrites])

  const { messages, sendMessage, addToolApprovalResponse, status, stop, error, clearError, regenerate } =
    useChat<Message>({
      id: chat.id,
      messages: chat.messages,
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })

  // Some changes live in the browser (the theme) or in this page's state (the mascot): a tool's
  // result can carry one, and it's applied here once, as it arrives. Results already in the chat
  // when it opened are history, not instructions, so they're skipped.
  const { setHideMascot } = usePreferences()
  const applied = useRef<Set<string> | null>(null)
  applied.current ??= new Set(chat.messages.flatMap((m) => m.parts.filter(isToolUIPart).map((p) => p.toolCallId)))
  useEffect(() => {
    for (const m of messages) {
      for (const p of m.parts) {
        if (!isToolUIPart(p) || p.state !== 'output-available' || applied.current!.has(p.toolCallId)) continue
        applied.current!.add(p.toolCallId)
        const effect = (p.output as { clientEffect?: ClientEffect } | undefined)?.clientEffect
        if (effect?.type === 'theme') applyTheme(effect.value)
        if (effect?.type === 'hideMascot') setHideMascot(effect.value, { save: false })
      }
    }
  }, [messages, setHideMascot])

  const [input, setInput] = useState('')
  const busy = status === 'submitted' || status === 'streaming'
  // Between steps (a lookup finished, the next hasn't started) nothing on screen moves; say so.
  const lastPart = messages.at(-1)?.role === 'assistant' ? messages.at(-1)!.parts.filter((p) => p.type === 'text' || isToolUIPart(p)).at(-1) : undefined
  const waiting =
    status === 'submitted' ||
    (status === 'streaming' &&
      (!lastPart ||
        (lastPart.type === 'text' ? !lastPart.text.trim() : isToolUIPart(lastPart) && (lastPart.state === 'output-available' || lastPart.state === 'output-error'))))
  const awaitingApproval = messages.some((m) => m.parts.some((p) => isToolUIPart(p) && p.state === 'approval-requested'))
  const empty = messages.length === 0

  // The title is written by a separate call while the first answer streams; pick it up once done.
  const [title, setTitle] = useState(chat.title)
  useEffect(() => {
    if (title || status !== 'ready' || messages.length === 0) return
    getChatTitle(chat.id).then((t) => t && setTitle(t))
  }, [chat.id, messages.length, status, title])

  // Follow the newest text while the reader is at the bottom; leave them be if they've scrolled up
  // to reread, until they send again. Scrolls the real scroll container to its end, so the latest
  // line clears the message box that sits over the bottom of the thread.
  const endRef = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  // The header lifts (a soft shadow) once the conversation is scrolling under it.
  const [lifted, setLifted] = useState(false)
  useEffect(() => {
    const scroller = scrollParent(endRef.current)
    if (!scroller) return
    const onScroll = () => {
      following.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
      setLifted(scroller.scrollTop > 2)
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [empty])
  useEffect(() => {
    const scroller = scrollParent(endRef.current)
    if (scroller && following.current) scroller.scrollTop = scroller.scrollHeight
  }, [messages, status])

  function send(text: string, files: FileUIPart[] = []) {
    const trimmed = text.trim()
    if ((!trimmed && files.length === 0) || busy || awaitingApproval) return false
    clearError()
    following.current = true
    if (empty) onStarted?.()
    sendMessage(trimmed ? { text: trimmed, files } : { files })
    setInput('')
    return true
  }

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={(files) => send(input, files)}
      onStop={stop}
      busy={busy}
      locked={awaitingApproval}
      autoFocus={variant === 'page'}
    />
  )
  const footer = <PermissionPicker confirmWrites={confirmWrites} onChange={setConfirmWrites} />

  const dock = (
    // Pinned to the very bottom: the negative bottom cancels the main column's bottom padding (p-4,
    // sm:pb-6), and the extra padding inside puts that space back, so nothing scrolls past below it.
    // The matching negative margin puts its resting place at the edge too, so it doesn't jump up at
    // the end of the scroll.
    <div className="sticky -bottom-4 -mb-4 bg-ground pb-7 pt-14 sm:-bottom-6 sm:-mb-6 sm:pb-9">
      {error && <ChatError error={error} onRetry={() => regenerate()} />}
      {composer}
      <div className="mt-1.5 flex justify-end px-1">{footer}</div>
    </div>
  )

  const thread = (
    <div className="space-y-6" aria-live="polite">
      {messages.map((m) => (
        <MessageView key={m.id} message={m} onApproval={addToolApprovalResponse} />
      ))}
      {waiting && (
        <p className="flex items-center gap-2 text-body text-fg-subtle">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Thinking…
        </p>
      )}
      <div ref={endRef} />
    </div>
  )

  if (variant === 'dock') {
    return (
      <NavigateContext.Provider value={navigate}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">{title ?? 'Mariner'}</span>
            <button
              type="button"
              onClick={onExpand}
              aria-label="Open the full chat"
              title="Open the full chat"
              className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Maximize2 size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Mariner"
              title="Close"
              className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{thread}</div>
          <div className="px-3 pb-3 pt-14">
            {error && <ChatError error={error} onRetry={() => regenerate()} />}
            {composer}
            <div className="mt-1.5 flex justify-end">{footer}</div>
          </div>
        </div>
      </NavigateContext.Provider>
    )
  }

  if (empty) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
        <div className="flex justify-end">
          <ChatHistory currentId={chat.id} onOpen={onOpenChat!} onNew={onNewChat!} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center pb-10">
          <h1 className="text-center text-3xl font-medium tracking-tight text-fg sm:text-4xl">
            <DashboardGreeting />
          </h1>
          <ul className="mt-8 w-full max-w-md divide-y divide-line overflow-hidden rounded-xl border border-line">
            {SUGGESTIONS.map(({ text, icon: Icon }) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => send(text)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-body text-fg-muted transition-colors hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden="true" />
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {dock}
      </div>
    )
  }

  return (
    <NavigateContext.Provider value={navigate}>
      <div className="flex min-h-full w-full flex-col">
        {/* A bar across the whole content area, the height of the sidebar's logo row (h-20), so the
            title lines up with the Spotlight logo. It starts at the very top (the negative margins
            and offsets cancel the main column's padding: top pt-16 / lg:pt-6, sides px-4 / sm:px-6),
            so where it rests and where it pins are the same and it never shifts. On phones it
            clears the menu button. */}
        <div
          className={`sticky -top-16 z-10 -mx-4 -mt-16 flex h-20 shrink-0 items-center bg-ground px-4 transition-shadow sm:-mx-6 sm:px-6 lg:-top-6 lg:-mt-6 ${
            lifted ? 'chat-header-lifted' : ''
          }`}
        >
          <div className="flex w-full items-center justify-between gap-4 max-lg:pl-12">
            <span className="min-w-0 truncate text-h2 font-medium text-fg">{title ?? <DashboardGreeting />}</span>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onNewChat} disabled={busy}>
                <Plus size={14} aria-hidden="true" /> New chat
              </Button>
              <ChatHistory currentId={chat.id} onOpen={onOpenChat!} onNew={onNewChat!} disabled={busy} />
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="flex-1 pb-6">{thread}</div>
          {dock}
        </div>
      </div>
    </NavigateContext.Provider>
  )
}

/**
 * The chat docked beside another page, after following a link from it. Hidden on the home page,
 * where the chat is already full width; "Open the full chat" goes back there.
 */
export function MarinerDockPanel() {
  const { chatId, undock } = useMarinerDock()
  const pathname = usePathname()
  const router = useRouter()
  const [chat, setChat] = useState<OpenChat | null>(null)

  // Coming back to the home page (from another page), the chat is the page: let go of the dock.
  // Only on arrival: docking happens while still on the home page, just before navigating away.
  const previousPath = useRef(pathname)
  useEffect(() => {
    const cameHome = pathname === '/dashboard' && previousPath.current !== '/dashboard'
    previousPath.current = pathname
    if (cameHome && chatId) undock()
  }, [pathname, chatId, undock])

  // Load the latest saved version of the chat whenever a different one is docked.
  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    loadChat(chatId).then((res) => {
      if (cancelled) return
      if ('error' in res) undock()
      else setChat({ id: chatId, title: res.title, messages: res.messages as Message[] })
    })
    return () => {
      cancelled = true
    }
  }, [chatId, undock])

  if (!chatId || pathname === '/dashboard' || chat?.id !== chatId) return null
  return (
    <aside
      aria-label="Mariner"
      className="fixed inset-y-0 right-0 z-40 w-full border-l border-line bg-ground shadow-xl sm:w-[26rem] lg:static lg:z-auto lg:shadow-none"
    >
      <Conversation
        key={chat.id}
        chat={chat}
        variant="dock"
        onExpand={() => {
          undock()
          router.push(`/dashboard?chat=${chat.id}`)
        }}
        onClose={undock}
      />
    </aside>
  )
}

// ── Messages ─────────────────────────────────────────────────────────

function MessageView({
  message,
  onApproval,
}: {
  message: Message
  onApproval: (r: { id: string; approved: boolean; reason?: string }) => void
}) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    const images = message.parts.flatMap((p) => (p.type === 'file' ? [uploadIdFromUrl(p.url)].filter((id): id is string => !!id) : []))
    return (
      <div className="flex flex-col items-end gap-2">
        {images.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
            {images.map((id) => (
              <SentImage key={id} id={id} />
            ))}
          </div>
        )}
        {text.trim() && <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-sunken px-4 py-2.5 text-body text-fg">{text}</p>}
      </div>
    )
  }

  // Step markers and reasoning aren't shown; dropping them first lets repeated lookups sit side by side.
  const parts = message.parts.filter((p) => p.type === 'text' || isToolUIPart(p))

  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.type === 'text') return part.text.trim() ? <RichText key={i} text={part.text} /> : null
        if (!isToolUIPart(part)) return null
        // Several lookups of the same kind in a row read as one line ("…catalogue ×3").
        const prev = parts[i - 1]
        if (prev && isToolUIPart(prev) && getToolName(prev) === getToolName(part) && !message.metadata?.previews?.[part.toolCallId]) {
          return null
        }
        let repeats = 1
        for (let k = i + 1; k < parts.length; k++) {
          const next = parts[k]
          if (!isToolUIPart(next) || getToolName(next) !== getToolName(part)) break
          repeats++
        }
        const name = getToolName(part)
        const preview = message.metadata?.previews?.[part.toolCallId]

        if (part.state === 'approval-requested') {
          return (
            <ConfirmCard
              key={i}
              preview={preview ?? fallbackPreview(name)}
              onConfirm={() => onApproval({ id: part.approval.id, approved: true })}
              onCancel={() => onApproval({ id: part.approval.id, approved: false, reason: 'The user chose "Not now" on the confirmation card.' })}
            />
          )
        }
        if (preview) return <ActionRecord key={i} preview={preview} part={part} />
        const last = parts[i + repeats - 1]
        return <ActivityLine key={i} name={name} part={isToolUIPart(last) ? last : part} repeats={repeats} />
      })}
    </div>
  )
}

/** An image the user sent, from their own uploads. Opens full size in a new tab. */
function SentImage({ id }: { id: string }) {
  const src = useUploadSrc(id)
  if (!src) return <span className="block size-28 animate-pulse rounded-xl bg-sunken" aria-label="Loading image" />
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-focus">
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed url, not an optimisable asset */}
      <img src={src} alt="Attached image" className="max-h-56 max-w-full object-cover sm:max-w-xs" />
    </a>
  )
}

/** Paragraphs, "- " lists and **bold**: enough for the agent's summaries without a markdown library. */
function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-2 text-body leading-relaxed text-fg">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => /^\s*[-•*] /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-fg-subtle">
              {lines.map((l, j) => (
                <li key={j}><Inline text={l.replace(/^\s*[-•*] /, '')} /></li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={block} />
          </p>
        )
      })}
    </div>
  )
}

/**
 * One line of agent text: **bold** and [links](/internal/path). Only links inside the app are
 * rendered; anything else stays plain text.
 */
function Inline({ text }: { text: string }) {
  const navigate = useContext(NavigateContext)
  const out: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*/g
  let last = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    const [whole, label, href, strong] = m
    if (href) out.push(<ChatLink key={m.index} href={href} label={label} navigate={navigate} />)
    else if (strong) out.push(<strong key={m.index} className="font-medium">{strong}</strong>)
    last = m.index! + whole.length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

function ChatLink({ href, label, navigate }: { href: string; label: string; navigate: (href: string) => void }) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Plain clicks dock the chat and go; modified clicks (new tab) behave as usual.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(href)
      }}
      className="text-fg underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-fg"
    >
      {label}
    </Link>
  )
}

// ── Actions ──────────────────────────────────────────────────────────

const KIND_ICON: Record<ActionPreview['kind'], LucideIcon> = {
  request: ShoppingCart,
  review: ClipboardCheck,
  order: Truck,
  approval: Stamp,
  receipt: Warehouse,
  pickup: MapPin,
  collected: PackageCheck,
  reject: CircleX,
  cancel: Trash2,
  bill: Receipt,
  payment: Banknote,
  issue: Bug,
  expense: CreditCard,
  card: CreditCard,
  stock: Boxes,
}

function fallbackPreview(name: string): ActionPreview {
  return { kind: 'order', title: humanize(name), done: humanize(name), fields: [] }
}

/** A pending change: what will happen, laid out to be checked at a glance. */
function ConfirmCard({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ActionPreview
  onConfirm: () => void
  onCancel: () => void
}) {
  const Icon = KIND_ICON[preview.kind]
  return (
    <section aria-label={`Confirm: ${preview.title}`} className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-fg">
          <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-medium text-fg">{preview.title}</h3>
          {preview.subject && <p className="mt-0.5 text-label text-fg-muted"><Inline text={preview.subject} /></p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-label font-medium ${
            preview.money ? 'bg-warning-soft text-warning' : 'bg-sunken text-fg-muted'
          }`}
        >
          {preview.money ? 'Money · needs OK' : 'Needs OK'}
        </span>
      </header>

      {preview.fields.length > 0 && (
        <dl className="mx-4 divide-y divide-line border-y border-line">
          {preview.fields.map((f) => (
            <div key={f.label} className="flex items-baseline gap-4 py-2">
              <dt className="w-28 shrink-0 text-label text-fg-subtle">{f.label}</dt>
              <dd className={`min-w-0 break-words text-body tabular-nums ${f.emphasis ? 'font-medium text-fg' : 'text-fg-muted'}`}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {preview.lines && preview.lines.length > 0 && (
        <ul className={`mx-4 space-y-1.5 ${preview.fields.length > 0 ? 'pt-3' : 'border-t border-line pt-3'}`}>
          {preview.lines.map((l, i) => (
            <li key={i} className="flex items-baseline gap-2 text-body">
              <span className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-fg-subtle" aria-hidden="true" />
              <span className="font-medium text-fg">{l.label}</span>
              {l.detail && <span className="text-label text-fg-subtle">{l.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line bg-sunken/60 px-4 py-3">
        <p className="text-label text-fg-subtle">Nothing changes until you confirm.</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Not now
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} autoFocus>
            Confirm
          </Button>
        </div>
      </footer>
    </section>
  )
}

type ToolState = { state: string; output?: unknown; errorText?: string }

function toolError(part: ToolState): string | null {
  if (part.state === 'output-error') return part.errorText ?? 'The action failed.'
  const out = part.output as { error?: unknown } | null | undefined
  if (part.state === 'output-available' && out && typeof out === 'object' && typeof out.error === 'string') return out.error
  return null
}

/** A change after the confirmation: running, done, cancelled or failed, compact. */
function ActionRecord({ preview, part }: { preview: ActionPreview; part: ToolState }) {
  const Icon = KIND_ICON[preview.kind]
  const error = toolError(part)
  const output = part.output as { requestCode?: string; pendingApproval?: boolean } | undefined
  const denied = part.state === 'output-denied'
  const done = part.state === 'output-available' && !error

  const key = preview.fields.filter((f) => f.emphasis).map((f) => f.value)
  if (done && output?.requestCode) key.unshift(output.requestCode)
  if (done && output?.pendingApproval) key.push('sent for approval')

  let status: ReactNode
  let title = preview.title
  if (denied) {
    status = <X size={14} className="text-fg-subtle" aria-hidden="true" />
    title = `Cancelled: ${preview.title.toLowerCase()}`
  } else if (error) {
    status = <CircleAlert size={14} className="text-danger" aria-hidden="true" />
    title = `Couldn't ${preview.title.toLowerCase()}`
  } else if (done) {
    status = <Check size={14} className="text-success" aria-hidden="true" />
    title = preview.done
  } else {
    status = <Loader2 size={14} className="animate-spin text-fg-subtle" aria-hidden="true" />
    title = `${preview.title}…`
  }

  return (
    <div className={`rounded-lg border border-line px-3 py-2 ${denied ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5">
        <Icon size={15} strokeWidth={1.75} className="shrink-0 text-fg-muted" aria-hidden="true" />
        <span className="text-body font-medium text-fg">{title}</span>
        {!denied && !error && key.length > 0 && (
          <span className="min-w-0 truncate text-label text-fg-subtle"><Inline text={key.join(' · ')} /></span>
        )}
        <span className="ml-auto shrink-0">{status}</span>
      </div>
      {error && <p className="mt-1 pl-[25px] text-label text-danger">{error}</p>}
    </div>
  )
}

// What the agent is doing while it looks things up: [in progress, done].
const ACTIVITY: Record<string, [string, string]> = {
  list_my_notifications: ['Checking your notifications', 'Checked your notifications'],
  list_employees: ['Looking through the employee directory', 'Looked through the employee directory'],
  get_my_profile: ['Checking your profile', 'Checked your profile'],
  list_departments: ['Checking departments', 'Checked departments'],
  list_my_reported_issues: ['Looking up your reports', 'Looked up your reports'],
  list_reported_issues: ['Checking reported issues', 'Checked reported issues'],
  list_my_incidents: ['Checking your incidents', 'Checked your incidents'],
  list_incident_queue: ['Checking the incident queue', 'Checked the incident queue'],
}

function ActivityLine({ name, part, repeats = 1 }: { name: string; part: ToolState; repeats?: number }) {
  const [running, finished] = ACTIVITY[name] ?? [humanize(name), humanize(name)]
  const error = toolError(part)
  let icon: ReactNode
  let text: string
  if (error) {
    icon = <CircleAlert size={13} className="text-danger" aria-hidden="true" />
    text = `${running} failed: ${error}`
  } else if (part.state === 'output-available') {
    icon = <Check size={13} className="text-fg-subtle" aria-hidden="true" />
    text = repeats > 1 ? `${finished} ×${repeats}` : finished
  } else {
    icon = <Loader2 size={13} className="animate-spin" aria-hidden="true" />
    text = `${running}…`
  }
  return <p className="flex items-center gap-2 text-label text-fg-subtle">{icon}{text}</p>
}

function ChatError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  let message = error.message
  try {
    message = JSON.parse(error.message).error ?? message
  } catch {}
  return (
    <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-body text-danger">
      <span>{message || 'Something went wrong.'}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

// ── Composer ─────────────────────────────────────────────────────────

type Attachment = { key: string; preview: string; name: string; id: string | null; error: string | null }

function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  locked,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  /** Returns whether it went out, so the attachments are only cleared once it did. */
  onSubmit: (files: FileUIPart[]) => boolean
  onStop: () => void
  busy: boolean
  locked: boolean
  autoFocus?: boolean
}) {
  const { hideMascot } = usePreferences()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const uploading = attachments.some((a) => !a.id && !a.error)
  const ready = attachments.filter((a) => a.id)
  const canSend = (value.trim().length > 0 || ready.length > 0) && !uploading && !locked

  function add(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    const room = MAX_IMAGES_PER_MESSAGE - attachments.length
    for (const file of images.slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID()
      const preview = URL.createObjectURL(file)
      setAttachments((list) => [...list, { key, preview, name: file.name || 'Pasted image', id: null, error: null }])
      uploadImage(file).then(
        (id) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, id } : a))),
        (e: Error) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, error: e.message } : a)))
      )
    }
  }

  function remove(key: string) {
    setAttachments((list) => {
      const gone = list.find((a) => a.key === key)
      if (gone) URL.revokeObjectURL(gone.preview)
      return list.filter((a) => a.key !== key)
    })
  }

  function submit() {
    if (!canSend) return
    const files: FileUIPart[] = ready.map((a) => ({
      type: 'file',
      mediaType: 'image/jpeg',
      url: `${UPLOAD_SCHEME}${a.id}`,
      filename: a.name,
    }))
    if (onSubmit(files)) {
      attachments.forEach((a) => URL.revokeObjectURL(a.preview))
      setAttachments([])
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={(e) => {
        if (locked || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        if (locked) return
        e.preventDefault()
        setDragging(false)
        add([...e.dataTransfer.files])
      }}
      className={`relative rounded-2xl border bg-surface py-2 pl-2 pr-2 transition-colors focus-within:border-line-strong ${
        dragging ? 'border-line-strong bg-sunken' : 'border-line'
      }`}
    >
      {!hideMascot && <MarinerMascot />}
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-2 pb-2 pt-1" aria-label="Attached images">
          {attachments.map((a) => (
            <li key={a.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
              <img
                src={a.preview}
                alt={a.name}
                className={`size-16 rounded-lg border object-cover ${a.error ? 'border-danger opacity-50' : 'border-line'}`}
              />
              {!a.id && !a.error && (
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-scrim">
                  <Loader2 size={16} className="animate-spin text-white" aria-label="Uploading" />
                </span>
              )}
              {a.error && (
                <span className="absolute inset-0 grid place-items-center" title={a.error}>
                  <CircleAlert size={18} className="text-danger" aria-label={a.error} />
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(a.key)}
                aria-label={`Remove ${a.name}`}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1">
        <input
          ref={picker}
          type="file"
          accept={ACCEPTED_IMAGES}
          multiple
          className="hidden"
          onChange={(e) => {
            add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={locked || attachments.length >= MAX_IMAGES_PER_MESSAGE}
          aria-label="Attach images"
          title="Attach images (or paste or drop them here)"
          className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-30"
        >
          <ImagePlus size={17} aria-hidden="true" />
        </button>
        <label htmlFor="home-chat-input" className="sr-only">
          Ask Mariner
        </label>
        <textarea
          id="home-chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
            if (files.length === 0) return
            e.preventDefault()
            add(files)
          }}
          rows={1}
          autoFocus={autoFocus}
          placeholder={locked ? 'Confirm or cancel the change above to continue' : 'Ask Mariner to look something up or get something done'}
          disabled={locked}
          className="field-sizing-content max-h-60 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-body text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
        />
        <div className="flex shrink-0 pb-0.5">
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="grid size-8 place-items-center rounded-full bg-action text-action-fg transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Square size={12} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              className="grid size-8 place-items-center rounded-full bg-action text-action-fg transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-30"
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

// ── History ──────────────────────────────────────────────────────────

function ChatHistory({
  currentId,
  onOpen,
  onNew,
  disabled,
}: {
  currentId: string
  onOpen: (id: string) => void
  onNew: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    setConfirmingDelete(null)
    if (!next) return
    // Fetched on every open so new chats and fresh titles show up.
    const res = await listChats()
    setLoadError('error' in res)
    setChats('error' in res ? [] : res)
  }

  async function remove(id: string) {
    const res = await deleteChat(id)
    if ('error' in res) return
    setChats((cs) => cs?.filter((c) => c.id !== id) ?? null)
    setConfirmingDelete(null)
    if (id === currentId) onNew()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Chat history"
        title="Chat history"
        className="grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
      >
        <History size={17} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat history"
          className="absolute right-0 top-full z-30 mt-1 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-label font-medium text-fg">Chats</span>
            <button
              type="button"
              onClick={() => {
                onNew()
                setOpen(false)
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-label text-fg-muted hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Plus size={13} aria-hidden="true" /> New chat
            </button>
          </div>

          <div className="overflow-y-auto p-1">
            {chats === null ? (
              <p className="flex items-center gap-2 px-2.5 py-3 text-label text-fg-subtle">
                <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading…
              </p>
            ) : loadError ? (
              <p className="px-2.5 py-3 text-label text-danger">Couldn&apos;t load your chats.</p>
            ) : chats.length === 0 ? (
              <p className="px-2.5 py-3 text-label text-fg-subtle">No chats yet. They&apos;ll show up here.</p>
            ) : (
              <ul>
                {chats.map((c) => {
                  const current = c.id === currentId
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          if (!current) onOpen(c.id)
                        }}
                        aria-current={current || undefined}
                        className={`flex w-full flex-col items-start rounded-md px-2.5 py-2 pr-10 text-left transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-focus ${
                          current ? 'bg-sunken' : ''
                        }`}
                      >
                        <span className="w-full truncate text-body text-fg">{c.title ?? 'Untitled chat'}</span>
                        <span className="text-label text-fg-subtle">{ago(c.updatedAt)}</span>
                      </button>
                      {confirmingDelete === c.id ? (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-danger-soft px-2 py-1 text-label font-medium text-danger focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(c.id)}
                          aria-label={`Delete ${c.title ?? 'chat'}`}
                          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-subtle opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus group-hover:opacity-100"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "Mon 14 Oct". */
function ago(iso: string) {
  const then = new Date(iso)
  const mins = Math.round((Date.now() - then.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 24 * 60 && then.getDate() === new Date().getDate()) return `${Math.round(mins / 60)} h ago`
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return then.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Permissions ──────────────────────────────────────────────────────

const MODES = [
  { confirm: true, label: 'Ask before changes', hint: 'Every change waits for you to confirm it' },
  { confirm: false, label: 'Act without asking', hint: 'Changes run straight away; lookups never ask' },
]

function PermissionPicker({ confirmWrites, onChange }: { confirmWrites: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = MODES.find((m) => m.confirm === confirmWrites) ?? MODES[0]

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-label text-fg-muted transition-colors hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {current.label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-20 mb-1 w-72 rounded-lg border border-line bg-surface p-1 shadow-lg">
          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              role="menuitemradio"
              aria-checked={m.confirm === confirmWrites}
              onClick={() => {
                onChange(m.confirm)
                setOpen(false)
              }}
              className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Check size={14} className={`mt-0.5 shrink-0 ${m.confirm === confirmWrites ? 'text-fg' : 'invisible'}`} aria-hidden="true" />
              <span>
                <span className="block text-body text-fg">{m.label}</span>
                <span className="block text-label text-fg-subtle">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Confirm-before-changes is on unless this browser has turned it off. */
function useConfirmWrites(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(CONFIRM_KEY) === 'false') setValue(false) // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
  }, [])
  return [
    value,
    (v) => {
      setValue(v)
      try {
        localStorage.setItem(CONFIRM_KEY, String(v))
      } catch {}
    },
  ]
}

function humanize(s: string) {
  const words = s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The nearest ancestor that scrolls vertically: the page's main column, or the dock's thread. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}
