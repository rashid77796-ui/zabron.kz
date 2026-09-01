'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { ImagePlus, X, Loader2 } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (urls: string[]) => void
  bucket?: string
  folder?: string
  max?: number
}

export function PhotoUploadField({
  value,
  onChange,
  bucket = 'zabron-store',
  folder = 'misc',
  max = 5,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    if (value.length + files.length > max) {
      toast.error(`Максимум ${max} фото`)
      return
    }

    setUploading(true)
    const uploaded: string[] = []

    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('bucket', bucket)
      form.append('folder', folder)

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          uploaded.push(data.url)
        } else {
          const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
          toast.error(err.error ?? 'Ошибка загрузки')
        }
      } catch {
        toast.error('Нет соединения')
      }
    }

    setUploading(false)
    if (uploaded.length) onChange([...value, ...uploaded])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative group">
            <img
              src={url}
              alt=""
              className="h-20 w-28 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Удалить"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-20 w-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-xs">{uploading ? 'Загрузка...' : 'Добавить'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) {
            handleFiles(e.target.files)
            e.target.value = ''
          }
        }}
      />
    </div>
  )
}
