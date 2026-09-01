import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listActivePromoBanners,
  listAllPromoBanners,
  createPromoBanner,
  updatePromoBanner,
  deletePromoBanner,
  type PromoBannerInput,
} from '@/server/services/promo'

const app = new Hono()

const bannerSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(300).nullish(),
  ctaLabel: z.string().max(60).nullish(),
  ctaUrl: z.string().max(500).nullish(),
  imageUrl: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
})

// Публично: активные баннеры для главной
app.get('/', async (c) => {
  return c.json(await listActivePromoBanners())
})

// Админ: все баннеры
app.get('/all', requireAuth, requireRole('super_admin'), async (c) => {
  return c.json(await listAllPromoBanners())
})

// Админ: создать
app.post('/', requireAuth, requireRole('super_admin'), zValidator('json', bannerSchema), async (c) => {
  return c.json(await createPromoBanner(c.req.valid('json') as PromoBannerInput))
})

// Админ: обновить
app.patch('/:id', requireAuth, requireRole('super_admin'), zValidator('json', bannerSchema.partial()), async (c) => {
  return c.json(await updatePromoBanner(c.req.param('id'), c.req.valid('json') as Partial<PromoBannerInput>))
})

// Админ: удалить
app.delete('/:id', requireAuth, requireRole('super_admin'), async (c) => {
  await deletePromoBanner(c.req.param('id'))
  return c.json({ ok: true })
})

export default app
