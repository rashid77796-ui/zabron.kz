'use client'

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, X, Link as LinkIcon, Film } from 'lucide-react';
import { isVideo } from '@/lib/media';

interface MediaUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  label?: string;
  allowVideo?: boolean;
}

const PhotoUpload = ({ photos, onChange, max = 5, label = 'Фото и видео', allowVideo = true }: MediaUploadProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = max - photos.length;
    const toProcess = files.slice(0, remaining);

    toProcess.forEach(file => {
      // Limit video to 50MB
      if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChange([...photos, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const addUrl = () => {
    if (urlInput.trim() && photos.length < max) {
      onChange([...photos, urlInput.trim()]);
      setUrlInput('');
      setShowUrl(false);
    }
  };

  const remove = (idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative group h-20 w-20 rounded-lg overflow-hidden border">
              {isVideo(src) ? (
                <video src={src} className="h-full w-full object-cover" muted />
              ) : (
                <img src={src} alt="" className="h-full w-full object-cover" />
              )}
              {isVideo(src) && (
                <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5">
                  <Film className="h-3 w-3 text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-0.5 right-0.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < max && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="gap-1.5">
            <ImagePlus className="h-4 w-4" />Фото
          </Button>
          {allowVideo && (
            <>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFiles}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} className="gap-1.5">
                <Film className="h-4 w-4" />Видео
              </Button>
            </>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setShowUrl(!showUrl)} className="gap-1.5">
            <LinkIcon className="h-4 w-4" />По ссылке
          </Button>
        </div>
      )}
      {showUrl && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          />
          <Button type="button" size="sm" onClick={addUrl} disabled={!urlInput.trim()}>Добавить</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{photos.length} / {max} медиа</p>
    </div>
  );
};

export default PhotoUpload;
