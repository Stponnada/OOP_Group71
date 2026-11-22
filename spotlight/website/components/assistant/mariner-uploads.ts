'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UPLOAD_BUCKET, uploadPath } from '@/lib/agent/upload-ref'

// Images given to Mariner: shrunk in the browser to a JPEG (photos from a phone are 3–8 MB; the
// model and the bucket need far less), then stored in the user's own folder of mariner-uploads.

const MAX_SIDE = 2000
const QUALITY = 0.85
export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif'

async function toJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name || 'That file'} isn't an image this browser can read. Try a JPEG or PNG.`)
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const g = canvas.getContext('2d')!
  // Transparent screenshots would turn black as JPEG; give them a white page.
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be prepared.'))), 'image/jpeg', QUALITY)
  )
}

// Read each time (it's local, no network): signing out and in as someone else doesn't reload the page.
async function currentUserId() {
  const { data } = await createClient().auth.getSession()
  return data.session?.user.id ?? null
}

/** Shrinks and stores one image; returns its upload id. Throws a message fit to show. */
export async function uploadImage(file: File): Promise<string> {
  const [blob, uid] = await Promise.all([toJpeg(file), currentUserId()])
  if (!uid) throw new Error('Your session has ended. Sign in again to attach images.')
  const id = crypto.randomUUID()
  const { error } = await createClient().storage.from(UPLOAD_BUCKET).upload(uploadPath(uid, id), blob, { contentType: 'image/jpeg' })
  if (error) throw new Error("The image couldn't be uploaded. Try again.")
  return id
}

// Keyed by upload id; ids are random, so one person's cache can't show them another's image.
const signed = new Map<string, Promise<string | null>>()

/** A short-lived link to one of the user's uploads, for showing it in the chat. */
export function useUploadSrc(id: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    let live = true
    if (!signed.has(id)) {
      signed.set(
        id,
        currentUserId().then(async (uid) => {
          if (!uid) return null
          const { data } = await createClient().storage.from(UPLOAD_BUCKET).createSignedUrl(uploadPath(uid, id), 60 * 60)
          return data?.signedUrl ?? null
        })
      )
    }
    signed.get(id)!.then((url) => live && setSrc(url))
    return () => {
      live = false
    }
  }, [id])
  return src
}
