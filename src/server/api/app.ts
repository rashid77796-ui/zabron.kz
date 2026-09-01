import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import categoriesRoute from './routes/categories'
import venuesRoute from './routes/venues'
import bookingsRoute from './routes/bookings'
import profileRoute from './routes/profile'
import telegramRoute from './routes/telegram'
import moderationRoute from './routes/moderation'
import reviewsRoute from './routes/reviews'
import favoritesRoute from './routes/favorites'
import discountsRoute from './routes/discounts'
import analyticsRoute from './routes/analytics'
import resourcesRoute from './routes/resources'
import waitlistRoute from './routes/waitlist'
import adminRoute from './routes/admin'
import uploadRoute from './routes/upload'
import notificationsRoute from './routes/notifications'
import referralsRoute from './routes/referrals'
import staffRoute from './routes/staff'
import questionsRoute from './routes/questions'
import pushRoute from './routes/push'
import promoRoute from './routes/promo'
import { rateLimit } from './middleware/rateLimit'

const app = new Hono().basePath('/api')

app.use('*', logger())
app.use('*', rateLimit({ windowMs: 60_000, max: 300 }))

// Public read endpoints (/venues, /categories) are open to any origin so merchant
// websites can embed the widget or call the API directly. Authenticated endpoints
// are restricted to the frontend origin only.
const FRONTEND_ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const PUBLIC_PREFIXES = ['/api/venues', '/api/categories']

app.use('/*', cors({
  origin: (origin, c) => {
    const path = c.req.path
    const isPublic = PUBLIC_PREFIXES.some(p => path.startsWith(p))
    if (isPublic) return origin ?? '*'
    return FRONTEND_ORIGIN
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  credentials: true,
  exposeHeaders: ['X-RateLimit-Remaining'],
}))

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

app.route('/categories', categoriesRoute)
app.route('/venues', venuesRoute)
app.route('/bookings', bookingsRoute)
app.route('/profile', profileRoute)
app.route('/telegram', telegramRoute)
app.route('/moderation', moderationRoute)
app.route('/reviews', reviewsRoute)
app.route('/favorites', favoritesRoute)
app.route('/discounts', discountsRoute)
app.route('/analytics', analyticsRoute)
app.route('/resources', resourcesRoute)
app.route('/waitlist', waitlistRoute)
app.route('/admin', adminRoute)
app.route('/upload', uploadRoute)
app.route('/notifications', notificationsRoute)
app.route('/referrals', referralsRoute)
app.route('/staff', staffRoute)
app.route('/push', pushRoute)
app.route('/promo-banners', promoRoute)
app.route('/', questionsRoute)

export default app
export type AppType = typeof app
