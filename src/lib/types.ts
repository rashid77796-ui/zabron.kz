// App-level user roles (stored as string in Better Auth additionalFields)
export type UserRole = 'client' | 'merchant' | 'moderator' | 'super_admin'

// Legacy aliases used in old pages — kept for backward compat during migration
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'auto_rejected' | 'slot_taken' | 'cancelled' | 'no_show' | 'completed'

export type VenueCategory = 'bath' | 'spa' | 'restaurant' | 'entertainment' | 'outdoor'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  image?: string
  link?: string
  noShowCount?: number
  emailVerified?: boolean
  /** Гость, вошедший без регистрации (плагин anonymous better-auth). */
  isAnonymous?: boolean
  // password is intentionally absent — managed by Better Auth
}

// ─── Legacy types (kept for pages not yet migrated to API) ───────────────────

export interface Bathhouse {
  id: string
  ownerId: string
  name: string
  address: string
  description: string
  photos: string[]
  phone?: string
  email?: string
  website?: string
  instagram?: string
  whatsapp?: string
  link?: string
  lat?: number
  lng?: number
  category?: VenueCategory
}

export interface Cabin {
  id: string
  bathhouseId: string
  name: string
  description: string
  price: number
  maxGuests: number
  photos: string[]
  workStart: string
  workEnd: string
  slotDuration: number
}

export interface TimeSlot {
  id: string
  cabinId: string
  bathhouseId: string
  date: string
  startTime: string
  endTime: string
  maxGuests: number
  status: 'free' | 'booked'
}

export interface Booking {
  id: string
  slotId: string
  cabinId: string
  bathhouseId: string
  clientId: string
  clientName: string
  clientPhone: string
  guests: number
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  comment?: string
  createdAt: string
}
