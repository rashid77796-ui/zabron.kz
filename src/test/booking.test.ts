import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingStatus, BookingSource } from '@prisma/client'

// ─── Mocks ──────────────────────────────────────────────────────────────────

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
  user: { update: vi.fn() },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResource(venueId = 'v1', merchantOwnerUserId = 'merchant1') {
  return {
    id: 'r1',
    venueId,
    allocationMode: 'SPECIFIC',
    quantity: 1,
    venue: {
      id: venueId,
      merchantId: 'm1',
      merchant: { id: 'm1', ownerUserId: merchantOwnerUserId },
    },
  }
}

function makeBooking(overrides: Partial<{
  id: string; status: BookingStatus; resourceId: string; clientUserId: string;
  startAt: Date; endAt: Date; guests: number
}> = {}) {
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
    resource: makeResource(),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BookingLimitError when pending count >= 3', async () => {
    mockPrisma.booking.count.mockResolvedValue(3)
    const { createBooking, BookingLimitError } = await import('@/server/services/booking')

    await expect(
      createBooking({
        resourceId: 'r1',
        clientUserId: 'user1',
        startAt: new Date(Date.now() + 3_600_000),
        endAt: new Date(Date.now() + 7_200_000),
        guests: 2,
      })
    ).rejects.toThrow(BookingLimitError)
  })

  it('creates booking when pending count < 3', async () => {
    mockPrisma.booking.count.mockResolvedValue(2)
    mockPrisma.resource.findUnique.mockResolvedValue({ allocationMode: 'SPECIFIC', quantity: 1 })
    const created = makeBooking()
    mockPrisma.booking.create.mockResolvedValue(created)
    const { createBooking } = await import('@/server/services/booking')

    const result = await createBooking({
      resourceId: 'r1',
      clientUserId: 'user1',
      startAt: created.startAt,
      endAt: created.endAt,
      guests: 2,
    })

    expect(result).toEqual(created)
    expect(mockPrisma.booking.create).toHaveBeenCalledOnce()
  })
})

describe('confirmBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SlotConflictError when a confirmed booking already overlaps', async () => {
    const booking = makeBooking({ status: BookingStatus.PENDING })

    // $transaction runs the callback synchronously in the mock
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.count.mockResolvedValue(1) // 1 confirmed overlap >= capacity 1

    const { confirmBooking, SlotConflictError } = await import('@/server/services/booking')

    await expect(
      confirmBooking('b1', 'merchant1')
    ).rejects.toThrow(SlotConflictError)
  })

  it('marks competing PENDING bookings as SLOT_TAKEN on confirm', async () => {
    const booking = makeBooking({ status: BookingStatus.PENDING })
    const confirmed = { ...booking, status: BookingStatus.CONFIRMED }

    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.count.mockResolvedValue(0) // no confirmed overlaps
    mockPrisma.booking.update.mockResolvedValue(confirmed)
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'competitor1' }])
    mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 })

    const { confirmBooking } = await import('@/server/services/booking')
    await confirmBooking('b1', 'merchant1')

    expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['competitor1'] } }),
        data: { status: BookingStatus.SLOT_TAKEN },
      })
    )
  })

  it('throws FORBIDDEN when merchant is not the owner', async () => {
    const booking = makeBooking({ status: BookingStatus.PENDING })
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const { confirmBooking } = await import('@/server/services/booking')
    await expect(confirmBooking('b1', 'wrong_merchant')).rejects.toThrow('FORBIDDEN')
  })
})

describe('rejectBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a PENDING booking', async () => {
    const booking = makeBooking({ status: BookingStatus.PENDING })
    const rejected = { ...booking, status: BookingStatus.REJECTED }

    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.update.mockResolvedValue(rejected)

    const { rejectBooking } = await import('@/server/services/booking')
    const result = await rejectBooking('b1', 'merchant1')

    expect(result.status).toBe(BookingStatus.REJECTED)
  })

  it('throws INVALID_STATUS when booking is not PENDING', async () => {
    const booking = makeBooking({ status: BookingStatus.CONFIRMED })
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const { rejectBooking } = await import('@/server/services/booking')
    await expect(rejectBooking('b1', 'merchant1')).rejects.toThrow('INVALID_STATUS')
  })
})

describe('cancelBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows client to cancel their own PENDING booking', async () => {
    const booking = makeBooking({ clientUserId: 'client1', status: BookingStatus.PENDING })
    const cancelled = { ...booking, status: BookingStatus.CANCELLED }

    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.update.mockResolvedValue(cancelled)

    const { cancelBooking } = await import('@/server/services/booking')
    const result = await cancelBooking('b1', 'client1')

    expect(result.status).toBe(BookingStatus.CANCELLED)
  })

  it('throws FORBIDDEN when a third party tries to cancel', async () => {
    const booking = makeBooking({ clientUserId: 'client1', status: BookingStatus.PENDING })
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const { cancelBooking } = await import('@/server/services/booking')
    await expect(cancelBooking('b1', 'random_user')).rejects.toThrow('FORBIDDEN')
  })
})

describe('processAutoRejections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns IDs of expired PENDING bookings and updates their status', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }])
    mockPrisma.booking.updateMany.mockResolvedValue({ count: 2 })

    const { processAutoRejections } = await import('@/server/services/booking')
    const ids = await processAutoRejections()

    expect(ids).toEqual(['b1', 'b2'])
    expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BookingStatus.AUTO_REJECTED } })
    )
  })

  it('returns empty array when no bookings are expired', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([])

    const { processAutoRejections } = await import('@/server/services/booking')
    const ids = await processAutoRejections()

    expect(ids).toEqual([])
    expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled()
  })
})

describe('rescheduleBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cancels old booking and creates a new PENDING one', async () => {
    const booking = makeBooking({ clientUserId: 'client1', status: BookingStatus.PENDING })
    const newBooking = makeBooking({ id: 'b2', clientUserId: 'client1', status: BookingStatus.PENDING })

    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.update.mockResolvedValue({ ...booking, status: BookingStatus.CANCELLED })
    mockPrisma.booking.count.mockResolvedValue(0)
    mockPrisma.booking.create.mockResolvedValue(newBooking)

    const { rescheduleBooking } = await import('@/server/services/booking')
    const result = await rescheduleBooking(
      'b1', 'client1',
      new Date(Date.now() + 7_200_000),
      new Date(Date.now() + 10_800_000),
    )

    expect(mockPrisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BookingStatus.CANCELLED, cancelledAt: expect.any(Date) } })
    )
    expect(result.id).toBe('b2')
  })

  it('throws FORBIDDEN when a third party tries to reschedule', async () => {
    const booking = makeBooking({ clientUserId: 'client1', status: BookingStatus.PENDING })
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)

    const { rescheduleBooking } = await import('@/server/services/booking')
    await expect(
      rescheduleBooking('b1', 'random_user', new Date(), new Date())
    ).rejects.toThrow('FORBIDDEN')
  })

  it('throws BookingLimitError when client already has 3 pending bookings', async () => {
    const booking = makeBooking({ clientUserId: 'client1', status: BookingStatus.PENDING })
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.booking.findUnique.mockResolvedValue(booking)
    mockPrisma.booking.update.mockResolvedValue({ ...booking, status: BookingStatus.CANCELLED })
    mockPrisma.booking.count.mockResolvedValue(3)

    const { rescheduleBooking, BookingLimitError } = await import('@/server/services/booking')
    await expect(
      rescheduleBooking('b1', 'client1', new Date(), new Date())
    ).rejects.toThrow(BookingLimitError)
  })
})

describe('getSuggestedSlots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns free slots when no bookings exist', async () => {
    mockPrisma.booking.findUnique = vi.fn().mockResolvedValue({
      id: 'r1',
      venue: { hours: [] },
    })
    // Need to add resource findUnique mock
    const mockResource = { id: 'r1', venue: { id: 'v1', hours: [] } }
    mockPrisma.booking.findMany.mockResolvedValue([])

    // Attach resource mock
    const mockResourceModel = { findUnique: vi.fn().mockResolvedValue(mockResource) }
    const mockBlackout = { findMany: vi.fn().mockResolvedValue([]) }
    Object.assign(mockPrisma, { resource: mockResourceModel, blackout: mockBlackout })

    const { getSuggestedSlots } = await import('@/server/services/booking')
    const result = await getSuggestedSlots({
      resourceId: 'r1',
      desiredStart: new Date('2025-01-01T14:00:00'),
      durationMs: 2 * 3600 * 1000,
      limit: 3,
    })

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('excludes slots that overlap with confirmed bookings', async () => {
    const slotStart = new Date('2025-01-01T14:00:00')
    const slotEnd = new Date('2025-01-01T16:00:00')

    const mockResourceModel = { findUnique: vi.fn().mockResolvedValue({ id: 'r1', venue: { hours: [] } }) }
    const mockBlackout = { findMany: vi.fn().mockResolvedValue([]) }
    Object.assign(mockPrisma, { resource: mockResourceModel, blackout: mockBlackout })

    // Block out 14:00–16:00
    mockPrisma.booking.findMany.mockResolvedValue([{ startAt: slotStart, endAt: slotEnd }])

    const { getSuggestedSlots } = await import('@/server/services/booking')
    const result = await getSuggestedSlots({
      resourceId: 'r1',
      desiredStart: slotStart,
      durationMs: 2 * 3600 * 1000,
    })

    const hasConflict = result.some(s =>
      s.startAt < slotEnd && s.endAt > slotStart
    )
    expect(hasConflict).toBe(false)
  })
})

describe('referral service', () => {
  beforeEach(() => vi.clearAllMocks())

  // Referral tests reuse the top-level mockPrisma — extend it with referral methods
  const mockReferral = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  }
  // Attach to mockPrisma so it's used by the already-mocked client
  Object.assign(mockPrisma, { referral: mockReferral })

  it('getOrCreateReferral returns existing referral without creating a new one', async () => {
    mockReferral.findFirst.mockResolvedValue({ id: 'ref1', referrerId: 'u1', code: 'ABCD1234' })

    const { getOrCreateReferral } = await import('@/server/services/referral')
    const result = await getOrCreateReferral('u1')
    expect(result.code).toBe('ABCD1234')
    expect(mockReferral.create).not.toHaveBeenCalled()
  })

  it('applyReferral throws SELF_REFERRAL when user applies their own code', async () => {
    mockReferral.findUnique.mockResolvedValue({
      id: 'ref1', referrerId: 'u1', refereeUserId: null, code: 'ABCD1234',
    })

    const { applyReferral } = await import('@/server/services/referral')
    await expect(applyReferral('ABCD1234', 'u1')).rejects.toThrow('SELF_REFERRAL')
  })

  it('applyReferral throws REFERRAL_ALREADY_USED when code is consumed', async () => {
    mockReferral.findUnique.mockResolvedValue({
      id: 'ref1', referrerId: 'u1', refereeUserId: 'u2', code: 'ABCD1234',
    })

    const { applyReferral } = await import('@/server/services/referral')
    await expect(applyReferral('ABCD1234', 'u3')).rejects.toThrow('REFERRAL_ALREADY_USED')
  })
})
