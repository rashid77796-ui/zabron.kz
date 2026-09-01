import * as Minio from 'minio'
import crypto from 'crypto'
import path from 'path'

export const BUCKET_VENUES = 'zabron-store'
export const BUCKET_REVIEWS = 'rh-reviews'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

let _client: Minio.Client | null = null

function getClient(): Minio.Client {
  if (_client) return _client

  const endpoint = process.env.S3_STORAGE_ENDPOINT
  if (!endpoint) throw new Error('S3_STORAGE_ENDPOINT not configured')

  const url = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`)

  _client = new Minio.Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port) : undefined,
    useSSL: url.protocol === 'https:',
    region: process.env.S3_STORAGE_REGION ?? 'us-east-1',
    accessKey: process.env.S3_STORAGE_ACCESS_KEY!,
    secretKey: process.env.S3_STORAGE_SECRET_KEY!,
    pathStyle: true,
  })

  return _client
}

function makeKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.jpg'
  const id = crypto.randomBytes(12).toString('hex')
  return `${folder}/${id}${ext}`
}

export function publicURL(bucket: string, key: string): string {
  const endpoint = process.env.S3_STORAGE_ENDPOINT!
  const base = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`
  return `${base.replace(/\/$/, '')}/${bucket}/${key}`
}

export async function uploadFile(params: {
  bucket: string
  folder: string
  buffer: Buffer
  originalName: string
  contentType: string
}): Promise<{ key: string; url: string }> {
  const { bucket, folder, buffer, originalName, contentType } = params

  if (!ALLOWED_TYPES.has(contentType)) throw new Error('INVALID_TYPE')
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('FILE_TOO_LARGE')

  const key = makeKey(folder, originalName)
  const client = getClient()

  await client.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': contentType,
  })

  return { key, url: publicURL(bucket, key) }
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  await getClient().removeObject(bucket, key)
}

export async function getPresignedURL(
  bucket: string,
  key: string,
  expirySeconds = 3600,
): Promise<string> {
  return getClient().presignedGetObject(bucket, key, expirySeconds)
}

export async function moveTempFiles(params: {
  bucket: string
  tempPrefix: string
  destPrefix: string
  keys: string[]
}): Promise<void> {
  const { bucket, tempPrefix, destPrefix, keys } = params
  const client = getClient()

  const objects = client.listObjects(bucket, tempPrefix, true)

  for await (const obj of objects) {
    if (!obj.name) continue
    const fileName = path.basename(obj.name)
    if (!keys.includes(fileName)) continue

    await client.copyObject(bucket, `${destPrefix}/${fileName}`, `/${bucket}/${obj.name}`)
    await client.removeObject(bucket, obj.name)
  }
}
