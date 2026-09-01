'use client'

import { Phone, MessageCircle, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Телефон клиента как кликабельное меню (правка #52).
 * По клику: Позвонить · Написать в WhatsApp · Скопировать номер.
 * Telegram по номеру не открывается (нет URL-схемы по телефону), поэтому не показываем.
 */
export function PhoneActions({ phone, className }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const digits = phone.replace(/[^\d+]/g, '')
  // wa.me требует номер без плюса и пробелов
  const waDigits = digits.replace(/\D/g, '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      toast.success('Номер скопирован')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 text-primary hover:underline ${className ?? ''}`}
        >
          <Phone className="h-3 w-3" />
          {phone}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <a href={`tel:${digits}`}>
            <Phone className="h-4 w-4" />
            Позвонить
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Написать в WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Скопировать номер
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
