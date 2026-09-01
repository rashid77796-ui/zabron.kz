/**
 * Integration tests: booking API routes via Hono app.request()
 *
 * These tests exercise the full request → middleware → handler → service stack,
 * catching bugs that pure unit tests miss (wrong HTTP status, missing auth
 * checks, schema validation, response shape).
 *
 * Prisma and Better Auth session lookups are mocked; everything above that
 * layer — routing, validation, error mapping — runs for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingStatus } from '@prisma/client'

// ─── DB / auth mocks ─────────────────────────────────────────────────────────

const mockPrisma = {
  booking: {
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  resource: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  merchant: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/server/db/client', () => ({ prisma: mockPrisma }))

vi.mock('@/server/services/notification', () => ({
  notifyBookingCreated: vi.fn().mockResolvedValue(undefined),
  notifyBookingConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyBookingRejected: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/server/services/admin', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const mockGetSession = vi.fn()
vi.mock('@/server/auth/auth', () => ({
  auth: { api: { getSession: mockGetSession } },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(id = 'user1', role = 'client') {
  return { id, name: 'Test User', email: `${id}@example.com`, role }
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: 'b1',
    status: BookingStatus.PENDING,
    resourceId: 'r1',
    clientUserId: 'user1',
    startAt: new Date(now.getTime() + 3_600_000),
    endAt: new Date(now.getTime() + 7_200_000),
    guests: 2,
    checkInCode: 'ABCD1234',
    autoRejectAt: new Date(now.getTime() + 86_400_000),
    comment: null,
    resource: {
      id: 'r1',
      name: 'Room 1',
      venueId: 'v1',
      venue: {
        id: 'v1',
        merchantId: 'm1',
        merchant: { id: 'm1', ownerUserId: 'merchant1' },
      },
    },
    ...overrides,
  }
}

function authenticateAs(userId: string, role = 'client') {
  mockGetSession.mockResolvedValue({ user: makeUser(userId, role) })
}

async function buildApp() {
  const { default: app } = await import('@/server/api/app')
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/bookings — create booking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceId: 'r1', startAt: new Date().toISOString(), endAt: new Date().toISOString(), guests: 1 }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is missing required fields', async () => {
    authenticateAs('user1')
    const app = await buildApp()
    const res = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests: 1 }), // missing resourceId, startAt, endAt
    })
    expect(res.status).toBe(400)
  })

  it('returns 422 when booking limit is reached', async () => {
    authenticateAs('user1')
    mockPrisma.booking.count.mockResolvedValue(3)
    const app = await buildApp()
    const now = new Date()
    const res = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceId: 'r1',
        startAt: new Date(now.getTime() + 3_600_000).toISOString(),
        endAt: new Date(now.getTime() + 7_200_000).toISOString(),
        guests: 1,
      }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('BOOKING_LIMIT')
  })

  it('returns 201 and booking when successful', async () => {
    authenticateAs('user1')
    mockPrisma.booking.count.mockResolvedValue(0)
    mockPrisma.resource.findUnique.mockResolvedValue({ allocationMode: 'SPECIFIC', quantity: 1 })
    const booking = makeBooking()
    mockPrisma.booking.create.mockResolvedValue(booking)
    const app = await buildApp()
    const now = new Date()
    const res = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceId: 'r1',
        startAt: new Date(now.getTime() + 3_600_000).toISOString(),
        endAt: new Date(now.getTime() + 7_200_000).toISOString(),
        guests: 2,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('id', 'b1')
  })
})

describe('POST /api/bookings/:id/action — confirm/cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.request('/api/bookings/b1/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 409 when confirming a slot with an overlap (SLOT_CONFLICT)', async () => {
    authenticateAs('merchant1', 'merchant')
    const booking = makeBooking({ status: BookingStatus.PENDING })
    const overlap = makeBooking({ id: 'b2', status: BookingStatus.CONFIRMED })

    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.count.mockResolvedValue(1) // 1 confirmed overlap >= capacity 1

    const app = await buildApp()
    const res = await app.request('/api/bookings/b1/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('SLOT_CONFLICT')
  })

  it('returns 403 when a third party tries to cancel', async () => {
    authenticateAs('other_user')
    const booking = makeBooking({ clientUserId: 'client1' })
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const app = await buildApp()
    const res = await app.request('/api/bookings/b1/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 when client cancels their own booking', async () => {
    authenticateAs('user1')
    const booking = makeBooking({ clientUserId: 'user1', status: BookingStatus.PENDING })
    const cancelled = { ...booking, status: BookingStatus.CANCELLED }
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.update.mockResolvedValue(cancelled)

    const app = await buildApp()
    const res = await app.request('/api/bookings/b1/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/bookings/my — list own bookings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.request('/api/bookings/my')
    expect(res.status).toBe(401)
  })

  it('returns array of bookings for authenticated user', async () => {
    authenticateAs('user1')
    mockPrisma.booking.findMany.mockResolvedValue([makeBooking()])

    const app = await buildApp()
    const res = await app.request('/api/bookings/my')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toHaveProperty('id', 'b1')
  })
})

describe('POST /api/bookings/:id/reschedule — reschedule booking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.request('/api/bookings/b1/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: new Date().toISOString(), endAt: new Date().toISOString() }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when a third party tries to reschedule', async () => {
    authenticateAs('other_user')
    const booking = makeBooking({ clientUserId: 'client1' })

    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const app = await buildApp()
    const now = new Date()
    const res = await app.request('/api/bookings/b1/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startAt: new Date(now.getTime() + 3_600_000).toISOString(),
        endAt: new Date(now.getTime() + 7_200_000).toISOString(),
      }),
    })
    expect(res.status).toBe(403)
  })
})
