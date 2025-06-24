import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import dayjs from 'dayjs'
import { getDayOrdersAmount } from './get-day-orders-amount'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('getDayOrdersAmount route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', function () {
      return Promise.resolve('rest-1')
    })

    await getDayOrdersAmount(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return today orders amount and diffFromYesterday correctly when both days have orders', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

    const ordersPerDay = [
      { dayWithMonthAndYear: yesterday, amount: 10 },
      { dayWithMonthAndYear: today, amount: 15 },
    ]

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue(ordersPerDay),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/day-orders-amount',
    })

    expect(response.statusCode).toBe(200)

    // Diff = ((15 * 100) / 10) - 100 = 50%
    expect(response.json()).toEqual({
      amount: 15,
      diffFromYesterday: 50.0,
    })
  })

  it('should return 0 and diffFromYesterday 0 if no orders found', async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/day-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 0,
      diffFromYesterday: 0,
    })
  })

  it('should handle case where only today orders exist', async () => {
    const today = dayjs().format('YYYY-MM-DD')

    const ordersPerDay = [{ dayWithMonthAndYear: today, amount: 5 }]

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue(ordersPerDay),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/day-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 5,
      diffFromYesterday: 0,
    })
  })

  it('should handle case where only yesterday orders exist', async () => {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

    const ordersPerDay = [{ dayWithMonthAndYear: yesterday, amount: 8 }]

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue(ordersPerDay),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/day-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 0,
      diffFromYesterday: 0,
    })
  })

  it('should call db.select with correct parameters', async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    await app.inject({
      method: 'GET',
      url: '/metrics/day-orders-amount',
    })

    expect(db.select).toHaveBeenCalled()
    expect(mockSelect.from).toHaveBeenCalledWith(orders)
    expect(mockSelect.where).toHaveBeenCalled()
    expect(mockSelect.groupBy).toHaveBeenCalled()
    expect(mockSelect.having).toHaveBeenCalled()
  })
})
