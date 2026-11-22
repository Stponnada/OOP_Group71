import type { UIMessage } from 'ai'

type Part = UIMessage['parts'][number]
import type { AgentContext } from './types'
import { UPLOAD_BUCKET, isUploadId, uploadIdFromUrl, uploadPath } from './upload-ref'

// Server side of images in a chat: hand them to the model, and copy one into a record's bucket
// when Mariner attaches it. Everything goes through the user's own session, so storage RLS
// decides: nobody can reach an upload that isn't theirs, whatever id the model passes.

/** Images older than this many (counting back from the newest) go to the model as a note, not pixels. */
const IMAGES_SENT_TO_MODEL = 6

async function download(ctx: AgentContext, uploadId: string): Promise<Blob | null> {
  if (!isUploadId(uploadId)) return null
  const { data, error } = await ctx.supabase.storage.from(UPLOAD_BUCKET).download(uploadPath(ctx.authUserId, uploadId))
  if (error || !data) return null
  return data
}

/**
 * Replaces each `mariner-upload:` file part with the image's bytes (as a data url) and a short note
 * naming its upload id, which is what tools take to attach it. The stored chat keeps the reference.
 */
export async function withUploadsForModel(ctx: AgentContext, messages: UIMessage[]): Promise<UIMessage[]> {
  const ids = messages.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'file' ? [uploadIdFromUrl(p.url)].filter((x): x is string => !!x) : []))
  )
  const recent = new Set(ids.slice(-IMAGES_SENT_TO_MODEL))
  const loaded = new Map<string, string | null>()
  await Promise.all(
    [...recent].map(async (id) => {
      const blob = await download(ctx, id)
      loaded.set(id, blob ? `data:image/jpeg;base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}` : null)
    })
  )

  // Images in the user's latest message are what "this" refers to; older ones are only context.
  const latestUser = messages.findLast((m) => m.role === 'user')?.id
  return messages.map((m) => ({
    ...m,
    parts: m.parts.flatMap((p): Part[] => {
      if (p.type !== 'file') return [p]
      const id = uploadIdFromUrl(p.url)
      if (!id) return [p]
      const data = loaded.get(id)
      const note = (text: string): Part => ({ type: 'text', text })
      const where = m.id === latestUser ? 'attached to this message' : 'from an earlier message; attach it only if the user points back to it'
      if (data) return [{ ...p, url: data, mediaType: 'image/jpeg' } as Part, note(`[Image ${where}. uploadId: ${id}]`)]
      if (recent.has(id)) return [note(`[An image (uploadId: ${id}) was attached but could not be loaded.]`)]
      return [note(`[An earlier image, uploadId: ${id}. Not shown again to save space; it can still be attached.]`)]
    }),
  })) as UIMessage[]
}

/**
 * Copies one of the user's uploads into another bucket, as the user. Returns where it landed, or an
 * error the model can relay.
 */
export async function copyUpload(
  ctx: AgentContext,
  uploadId: string,
  bucket: string,
  folder: string
): Promise<{ path: string; size: number } | { error: string }> {
  const blob = await download(ctx, uploadId)
  if (!blob) return { error: 'That image could not be found. Ask the user to attach it again.' }
  // Unique per copy: the same image can go on two records.
  const path = `${folder}/${Date.now()}_${uploadId}.jpg`
  const { error } = await ctx.supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) return { error: `The image could not be attached: ${error.message}` }
  return { path, size: blob.size }
}

/** Whether an upload exists in the user's own folder (for records that point at it directly). */
export async function ownUploadPath(ctx: AgentContext, uploadId: string): Promise<string | null> {
  return (await download(ctx, uploadId)) ? uploadPath(ctx.authUserId, uploadId) : null
}
