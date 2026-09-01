import { handle } from 'hono/vercel'
import app from '@/server/api/app'
import { startScheduler } from '@/server/jobs/scheduler'

export const runtime = 'nodejs'

startScheduler()

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
