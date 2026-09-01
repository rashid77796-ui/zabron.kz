interface Props {
  value: string
  min: number
  max?: number
}

/** Показывает текущую длину и требование по символам; краснеет, если не проходит. */
export function CharCounter({ value, min, max }: Props) {
  const len = value.trim().length
  const ok = len >= min && (max === undefined || len <= max)
  const requirement = max ? `${min}–${max} символов` : `минимум ${min} символов`
  return (
    <span className={ok ? 'text-muted-foreground' : 'text-destructive'}>
      {len} / {requirement}
    </span>
  )
}
