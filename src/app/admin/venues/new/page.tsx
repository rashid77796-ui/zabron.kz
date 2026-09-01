'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import { CollapsibleMap } from '@/components/CollapsibleMap'
import { CharCounter } from '@/components/CharCounter'
import { z } from 'zod'
import { createVenueSchema, venueIssuesToFieldErrors } from '@/lib/schemas/venue'

// Карта для выбора точки заведения кликом/перетаскиванием маркера. Только на клиенте.
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })

function NewAdminVenueContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    lat: '',
    lng: '',
    phone: '',
    categoryId: '',
    listingOnly: true,
    photos: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
    if (!authLoading && user && user.role !== 'super_admin') router.push('/')
  }, [user, authLoading, router])

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  })

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof createVenueSchema>) => api.venues.create(data),
    onSuccess: () => {
      toast.success('Заведение создано')
      router.push('/admin')
    },
    onError: (e: Error & { issues?: z.ZodIssue[] }) => {
      // Fallback: surface server-side validation errors on the matching fields
      if (e.issues?.length) {
        const fieldErrors = venueIssuesToFieldErrors(e.issues, form)
        setErrors(fieldErrors)
        toast.error('Проверьте заполнение полей', { description: Object.values(fieldErrors)[0] })
        return
      }
      toast.error('Не удалось создать заведение', { description: e.message })
    },
  })

  const handleSubmit = () => {
    const payload = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      lat: parseFloat(form.lat) || 51.18,
      lng: parseFloat(form.lng) || 71.45,
      phone: form.phone || undefined,
      listingOnly: form.listingOnly,
      photos: form.photos,
    }
    const result = createVenueSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors = venueIssuesToFieldErrors(result.error.issues, payload)
      setErrors(fieldErrors)
      toast.error('Проверьте заполнение полей', { description: Object.values(fieldErrors)[0] })
      return
    }
    setErrors({})
    mutation.mutate(result.data)
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
  }

  if (authLoading || !user) return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold">Добавить заведение</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основная информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Название *</Label>
              <Input id="name" value={form.name} onChange={set('name')} placeholder="Баня «Берёзка»"
                aria-invalid={!!errors.name}
                className={`mt-1 ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
              <div className="mt-1 flex justify-between gap-2 text-xs">
                <span className="text-destructive">{errors.name}</span>
                <CharCounter value={form.name} min={2} max={100} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description">Описание *</Label>
              <Textarea id="description" value={form.description} onChange={set('description')} rows={4}
                placeholder="Расскажите о заведении: услуги, атмосфера, особенности..."
                aria-invalid={!!errors.description}
                className={`mt-1 ${errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
              <div className="mt-1 flex justify-between gap-2 text-xs">
                <span className="text-destructive">{errors.description}</span>
                <CharCounter value={form.description} min={10} max={2000} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="address">Адрес *</Label>
              <Input id="address" value={form.address} onChange={set('address')}
                placeholder="Астана, ул. Примерная, 1"
                aria-invalid={!!errors.address}
                className={`mt-1 ${errors.address ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
              <div className="mt-1 flex justify-between gap-2 text-xs">
                <span className="text-destructive">{errors.address}</span>
                <CharCounter value={form.address} min={5} max={200} />
              </div>
            </div>

            <div>
              <Label htmlFor="lat" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />Широта
              </Label>
              <Input id="lat" value={form.lat} onChange={set('lat')} placeholder="51.1801" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="lng">Долгота</Label>
              <Input id="lng" value={form.lng} onChange={set('lng')} placeholder="71.4460" className="mt-1" />
            </div>

            <div className="sm:col-span-2">
              <Label>Точка на карте</Label>
              <div className="mt-1">
                <CollapsibleMap defaultOpen label="Показать карту" hideLabel="Свернуть карту">
                  <LocationPicker
                    lat={parseFloat(form.lat) || 0}
                    lng={parseFloat(form.lng) || 0}
                    onChange={(lat, lng) => setForm(f => ({ ...f, lat: String(lat), lng: String(lng) }))}
                  />
                </CollapsibleMap>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Телефон</Label>
              <PhoneInput id="phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="category">Категория *</Label>
              <select
                id="category"
                className={`mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background ${errors.categoryId ? 'border-destructive' : ''}`}
                value={form.categoryId}
                onChange={set('categoryId')}
              >
                <option value="">Выберите категорию</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.nameRu}</option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId}</p>}
            </div>

            <div className="sm:col-span-2">
              <Label>Фотографии</Label>
              <div className="mt-1">
                <PhotoUploadField
                  value={form.photos}
                  onChange={urls => setForm(f => ({ ...f, photos: urls }))}
                  folder="venues"
                />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.listingOnly}
              onChange={e => setForm(f => ({ ...f, listingOnly: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-amber-900">Витринное заведение (без бронирования)</span>
              <span className="block text-xs text-amber-800">Показывается в каталоге для полноты, но без онлайн-брони и кабинета. Публикуется сразу.</span>
            </span>
          </label>

          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? 'Создаём...' : 'Создать заведение'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {form.listingOnly
                ? 'Заведение будет опубликовано сразу после создания.'
                : 'После создания заведение будет в статусе «Черновик» — потребуется отправить на модерацию.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewAdminVenuePage() {
  return <Suspense><NewAdminVenueContent /></Suspense>
}
