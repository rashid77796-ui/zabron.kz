import Image from 'next/image'

// Логотип из /public: знак (квадрат) и горизонтальная версия со словом Zabron.
// Пропорции берутся из самих файлов, размер на странице задаётся высотой —
// className вида "h-7 w-auto". Менять надо обе размерности (h-* и w-auto),
// иначе next/image ругается на искажение пропорций.
type LogoProps = {
  variant?: 'mark' | 'wordmark'
  className?: string
  priority?: boolean
}

const SIZES = {
  mark: { src: '/logo_sm.svg', width: 545, height: 545 },
  wordmark: { src: '/logo_md.svg', width: 3741, height: 944 },
} as const

export function Logo({ variant = 'wordmark', className, priority }: LogoProps) {
  const { src, width, height } = SIZES[variant]
  return (
    <Image
      src={src}
      alt="Zabron"
      width={width}
      height={height}
      priority={priority}
      className={className}
      // В SVG оптимизировать нечего, а /_next/image для него всё равно
      // потребовал бы dangerouslyAllowSVG — отдаём файл как есть.
      unoptimized
    />
  )
}
