import { MiddlewareHandler } from 'hono'

interface RateLimitOptions {
  windowMs: number
  max: number
  keyFn?: (c: Parameters<MiddlewareHandler>[0]) => string
}

const store = new Map<string, { count: number; resetAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k)
  }
}, 60_000)

export function rateLimit({ windowMs, max, keyFn }: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const key = keyFn
      ? keyFn(c)
      : (c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown')

    const now = Date.now()
    let record = store.get(key)

    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowMs }
      store.set(key, record)
    }

    record.count++

    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)))

    if (record.count > max) {
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429)
    }

    await next()
  }
}
