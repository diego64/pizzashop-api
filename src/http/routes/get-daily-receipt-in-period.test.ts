import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import dayjs from 'dayjs'

import { getDailyReceiptInPeriod } from './get-daily-receipt-in-period'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('getDailyReceiptInPeriod route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', function () {
      return Promise.resolve('rest-1')
    })

    await getDailyReceiptInPeriod(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return 400 if query parameters are invalid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/metrics/daily-receipt-in-period?from=invalid-date',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ message: 'Invalid query parameters' })
  })

  it('should return 400 if period is greater than 7 days', async () => {
    const from = dayjs().subtract(10, 'days').format('YYYY-MM-DD')
    const to = dayjs().format('YYYY-MM-DD')

    const response = await app.inject({
      method: 'GET',
      url: `/metrics/daily-receipt-in-period?from=${from}&to=${to}`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'INVALID_PERIOD',
      message: 'O intervalo das datas não pode ser superior a 7 dias.',
    })
  })

  it('should return sorted daily receipts for valid period', async () => {
    const receiptData = [
      { date: '04/06', receipt: 3000 },
      { date: '02/06', receipt: 1000 },
      { date: '03/06', receipt: 2000 },
    ]

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue(receiptData),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/daily-receipt-in-period',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      { date: '02/06', receipt: 1000 },
      { date: '03/06', receipt: 2000 },
      { date: '04/06', receipt: 3000 },
    ])
  })

  it('should return empty list if no receipts found', async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/daily-receipt-in-period',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([])
  })

  it('should infer end date as 7 days after start if only from is provided', async () => {
    const from = dayjs().subtract(6, 'days').format('YYYY-MM-DD')
    const receiptData = [{ date: '01/06', receipt: 1500 }]

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue(receiptData),
    }

    vi.mocked(db.select).mockReturnValue(mockSelect as any)

    const response = await app.inject({
      method: 'GET',
      url: `/metrics/daily-receipt-in-period?from=${from}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(receiptData)
  })
})
