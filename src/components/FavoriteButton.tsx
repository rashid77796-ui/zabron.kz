'use client'

import { Heart } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Сердечко «в избранное» для карточек заведений (правка #56).
 * Внутри <Link> — клик гасится, чтобы не открывать заведение.
 * Неавторизованных отправляем на вход.
 */
export function FavoriteButton({ venueId, className }: { venueId: string; className?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: check } = useQuery({
    queryKey: ['favorite-check', venueId],
    queryFn: () => api.favorites.check(venueId),
    enabled: !!user,
  })
  const favorited = !!check?.favorited

  const mutation = useMutation({
    mutationFn: () => api.favorites.toggle(venueId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['favorite-check', venueId] })
      toast.success(data.favorited ? 'Добавлено в избранное' : 'Удалено из избранного')
    },
    onError: () => toast.error('Не удалось изменить избранное'),
  })

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      toast.info('Войдите, чтобы сохранять избранное')
      router.push('/auth')
      return
    }
    mutation.mutate()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={mutation.isPending}
      aria-label={favorited ? 'Убрать из избранного' : 'В избранное'}
      title={favorited ? 'Убрать из избранного' : 'В избранное'}
      className={`pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-black/35 backdrop-blur-sm transition-colors hover:bg-black/55 ${className ?? ''}`}
    >
      <Heart className={`h-4 w-4 ${favorited ? 'fill-red-500 text-red-500' : 'text-white'}`} />
    </button>
  )
}
