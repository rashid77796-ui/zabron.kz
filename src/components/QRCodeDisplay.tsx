'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QRCodeDisplay({ value, size = 140 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [value, size])

  if (!dataUrl) return null
  return (
    <img
      src={dataUrl}
      alt={`QR: ${value}`}
      width={size}
      height={size}
      className="rounded-lg border"
    />
  )
}
