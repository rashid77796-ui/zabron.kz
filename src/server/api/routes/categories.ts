import { Hono } from 'hono'
import { prisma } from '@/server/db/client'

const app = new Hono()

app.get('/', async (c) => {
  const categories = await prisma.category.findMany({ orderBy: { nameRu: 'asc' } })
  return c.json(categories)
})

export default app
