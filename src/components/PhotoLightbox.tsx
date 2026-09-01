'use client'

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { isVideo } from '@/lib/media';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PhotoLightbox = ({ photos, initialIndex = 0, open, onOpenChange }: PhotoLightboxProps) => {
  const [index, setIndex] = useState(initialIndex);

  const current = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(photos.length - 1, i)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 sm:rounded-xl overflow-hidden [&>button]:text-white [&>button]:hover:text-white/80 z-[9999]">
        <div className="relative flex items-center justify-center w-full h-[85vh]">
          {isVideo(current) ? (
            <video src={current} className="max-h-full max-w-full object-contain" controls autoPlay />
          ) : (
            <img src={current} alt="" className="max-h-full max-w-full object-contain" />
          )}

          {hasPrev && (
            <button onClick={() => goTo(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button onClick={() => goTo(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {index + 1} / {photos.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoLightbox;
