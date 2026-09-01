'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Слайдер промо-баннеров в верху главной (по образцу kino.kz).
 * Прокрутка на CSS scroll-snap — без сторонних каруселей: свайп на тач-устройствах
 * работает нативно, стрелки нужны только там, где нет тача.
 */
export function HeroSlider() {
  const { data } = useQuery({
    queryKey: ['promo-banners'],
    queryFn: () => api.promoBanners.list(),
    staleTime: 5 * 60_000,
  })

  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = data?.length ?? 0

  // Активный слайд определяем по позиции скролла — источник правды один,
  // поэтому свайп, стрелки и точки не рассинхронизируются. Считаем по реальным
  // координатам детей, а не по scrollLeft/clientWidth: на мобильных слайд уже
  // скроллпорта (соседние выглядывают по краям), и деление на ширину врало бы.
  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const r = child.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setIndex(best)
  }, [])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el || count === 0) return
    const child = el.children[(i + count) % count] as HTMLElement | undefined
    if (!child) return
    // Довозим слайд до центра скроллпорта. На десктопе он во всю ширину,
    // и центрирование совпадает с выравниванием по левому краю.
    const track = el.getBoundingClientRect()
    const slide = child.getBoundingClientRect()
    el.scrollBy({
      left: slide.left - track.left - (track.width - slide.width) / 2,
      behavior: 'smooth',
    })
  }, [count])

  // Автопрокрутка; на hover и при единственном слайде — стоит.
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (count < 2 || paused) return
    const id = setInterval(() => goTo(index + 1), 6000)
    return () => clearInterval(id)
  }, [count, paused, index, goTo])

  if (!data || count === 0) return null

  return (
    <section className="container mx-auto px-4 pt-4">
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* На узких экранах слайд занимает не всю ширину, а боковые поля дают
            соседним выглядывать по краям — сразу видно, что баннер листается.
            Единицы vw, а не проценты: секция уже задаёт px-4, и процент считался
            бы от суженной ширины — слайд выходил заметно уже задуманного. По той
            же причине -mx-4: трек должен идти во всю ширину экрана.
            11vw поля ровно центрируют первый и последний слайд, поэтому
            scroll-padding не нужен. От sm возвращаемся к одному слайду во всю
            ширину: там о прокрутке говорят стрелки. */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-[11vw] sm:mx-0 sm:gap-0 sm:rounded-2xl sm:px-0"
        >
          {data.map(b => {
            const inner = (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[3/1] sm:rounded-none">
                {b.imageUrl && (
                  <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
                {(b.title || b.subtitle || b.ctaLabel) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 sm:p-6">
                    {b.title && (
                      <p className="text-base font-semibold text-white sm:text-2xl">{b.title}</p>
                    )}
                    {b.subtitle && (
                      <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">{b.subtitle}</p>
                    )}
                    {b.ctaLabel && (
                      <span className="mt-3 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-foreground">
                        {b.ctaLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
            // 78vw — доля из замеров kino.kz: соседние слайды выглядывают
            // примерно на 40px при ширине экрана 430.
            const cls = 'w-[78vw] shrink-0 snap-center sm:w-full sm:snap-start'
            return b.ctaUrl
              ? <Link key={b.id} href={b.ctaUrl} className={cls}>{inner}</Link>
              : <div key={b.id} className={cls}>{inner}</div>
          })}
        </div>

        {count > 1 && (
          <>
            <SliderArrow side="left" onClick={() => goTo(index - 1)} />
            <SliderArrow side="right" onClick={() => goTo(index + 1)} />
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {data.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => goTo(i)}
                  aria-label={`Слайд ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function SliderArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Предыдущий слайд' : 'Следующий слайд'}
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:flex ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
