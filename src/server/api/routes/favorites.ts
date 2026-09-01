import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { toggleFavorite, listFavorites, checkFavorite } from '@/server/services/favorites'

const app = new Hono()

app.get('/', requireAuth, async (c) => {
  const userId = c.get('userId')
  const favorites = await listFavorites(userId)
  return c.json(favorites)
})

app.post('/:venueId', requireAuth, async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.param('venueId')
  const result = await toggleFavorite(userId, venueId)
  return c.json(result)
})

app.get('/:venueId/check', requireAuth, async (c) => {
  const userId = c.get('userId')
  const venueId = c.req.param('venueId')
  const result = await checkFavorite(userId, venueId)
  return c.json(result)
})

export default app
