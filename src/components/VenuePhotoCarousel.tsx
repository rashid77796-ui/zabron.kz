'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Листаемая галерея фото в карточке заведения (правка #47).
 * Свайп (тач), стрелки (десктоп по ховеру), точки-индикаторы.
 * Взаимодействие с галереей не открывает заведение (клик по стрелке/точке и свайп
 * гасятся, чтобы обёртка-<Link> не сработала).
 */
export function VenuePhotoCarousel({
  photos,
  alt,
  fallback,
}: {
  photos: string[]
  alt: string
  fallback?: React.ReactNode
}) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const dragged = useRef(false)
  const count = photos.length

  const step = (n: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx(prev => (prev + n + count) % count)
  }
  const goTo = (i: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx(i)
  }

  if (count === 0) {
    return <div className="flex h-full w-full items-center justify-center">{fallback}</div>
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; dragged.current = false }}
      onTouchMove={e => {
        if (touchStartX.current == null) return
        if (Math.abs(e.touches[0].clientX - touchStartX.current) > 10) dragged.current = true
      }}
      onTouchEnd={e => {
        if (touchStartX.current == null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        if (Math.abs(dx) > 40) setIdx(prev => (prev + (dx < 0 ? 1 : -1) + count) % count)
        touchStartX.current = null
      }}
      onClickCapture={e => {
        // если это был свайп — не открываем заведение
        if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false }
      }}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {photos.map((p, i) => (
          <img
            key={i}
            src={p}
            alt={alt}
            draggable={false}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="h-full w-full shrink-0 object-cover select-none"
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={e => step(-1, e)}
            aria-label="Предыдущее фото"
            className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={e => step(1, e)}
            aria-label="Следующее фото"
            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Фото ${i + 1}`}
                onClick={e => goTo(i, e)}
                className={`pointer-events-auto h-1.5 rounded-full shadow transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
