'use client'

import Link from 'next/link'
import { type ApiVenue } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Banknote, Home, Phone, Film, Star } from 'lucide-react'
import { isVideo } from '@/lib/media'

// Legacy alias — new code should import VenueCard from @/components/VenueCard
const BathhouseCard = ({ venue }: { venue: ApiVenue }) => {
  const minPrice = venue.resources.length > 0
    ? Math.min(...venue.resources.map(r => r.price ?? r.pricePerHour ?? 0).filter(p => p > 0))
    : 0

  const photo = venue.photos[0]

  return (
    <Link href={`/venues/${venue.id}`}>
      <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="aspect-[16/10] overflow-hidden relative">
          {photo && isVideo(photo) ? (
            <>
              <video src={photo} className="h-full w-full object-cover" muted loop autoPlay playsInline />
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5">
                <Film className="h-3.5 w-3.5 text-white" />
              </div>
            </>
          ) : (
            <img
              src={photo || '/placeholder.svg'}
              alt={venue.name}
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          )}
          {venue.isFeatured && (
            <Badge className="absolute top-2 left-2 bg-amber-500">В топе</Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg leading-tight">{venue.name}</h3>
            {venue.avgRating != null && (
              <div className="flex items-center gap-1 text-sm text-amber-500 shrink-0">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{venue.avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          {venue.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{venue.description}</p>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{venue.address}</span>
          </div>
          {venue.phone && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {venue.phone}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Home className="h-3.5 w-3.5" />
              {venue.resources.length} {
                venue.resources.length === 1 ? 'ресурс' :
                venue.resources.length < 5 ? 'ресурса' : 'ресурсов'
              }
            </span>
            {minPrice > 0 && (
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Banknote className="h-4 w-4" />
                от {minPrice.toLocaleString()} ₸
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default BathhouseCard
