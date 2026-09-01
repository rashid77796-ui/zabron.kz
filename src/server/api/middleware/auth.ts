import { createMiddleware } from 'hono/factory'
import { auth } from '@/server/auth/auth'

type AuthEnv = {
  Variables: {
    userId: string
    userRole: string
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  c.set('userId', session.user.id)
  c.set('userRole', (session.user as { role?: string }).role ?? 'client')
  await next()
})

export const requireRole = (...roles: string[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const role = c.get('userRole')
    if (!roles.includes(role)) {
      return c.json({ error: 'FORBIDDEN' }, 403)
    }
    await next()
  })
