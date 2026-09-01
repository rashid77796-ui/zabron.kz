import { Hono } from 'hono'
import { requireAuth } from '@/server/api/middleware/auth'
import { uploadFile, MAX_UPLOAD_BYTES, BUCKET_VENUES, BUCKET_REVIEWS } from '@/server/services/s3'

const VALID_BUCKETS = new Set([BUCKET_VENUES, BUCKET_REVIEWS])

const app = new Hono()

app.post('/', requireAuth, async (c) => {
  if (!process.env.S3_STORAGE_ENDPOINT) {
    return c.json({ error: 'S3_NOT_CONFIGURED' }, 503)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'INVALID_FORM_DATA' }, 400)
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) return c.json({ error: 'NO_FILE' }, 400)
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'FILE_TOO_LARGE' }, 400)

  const bucket = (formData.get('bucket') as string | null) ?? BUCKET_VENUES
  const folder = (formData.get('folder') as string | null) ?? 'misc'

  if (!VALID_BUCKETS.has(bucket)) return c.json({ error: 'INVALID_BUCKET' }, 400)

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await uploadFile({
      bucket,
      folder,
      buffer,
      originalName: file.name,
      contentType: file.type,
    })
    return c.json(result, 201)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UPLOAD_FAILED'
    if (msg === 'INVALID_TYPE') return c.json({ error: 'Недопустимый тип файла (jpeg/png/webp/gif)' }, 400)
    if (msg === 'FILE_TOO_LARGE') return c.json({ error: 'Файл больше 10 МБ' }, 400)
    console.error('[upload]', msg)
    return c.json({ error: 'UPLOAD_FAILED' }, 500)
  }
})

export default app
