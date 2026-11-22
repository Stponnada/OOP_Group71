// Images given to Mariner live in the private `mariner-uploads` bucket at <auth user id>/<upload id>.jpg.
// A chat message refers to one as a file part whose url is `mariner-upload:<upload id>`, so stored
// chats hold a reference, never the image itself. Shared by the browser and the server.

export const UPLOAD_BUCKET = 'mariner-uploads'
export const UPLOAD_SCHEME = 'mariner-upload:'
/** Most images one message can carry. */
export const MAX_IMAGES_PER_MESSAGE = 4

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const isUploadId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)

export const uploadPath = (authUserId: string, uploadId: string) => `${authUserId}/${uploadId}.jpg`

/** The upload id in a `mariner-upload:` url, or null for any other url. */
export function uploadIdFromUrl(url: string): string | null {
  if (!url.startsWith(UPLOAD_SCHEME)) return null
  const id = url.slice(UPLOAD_SCHEME.length)
  return isUploadId(id) ? id : null
}
