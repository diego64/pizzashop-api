import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { getMonthCanceledOrdersAmount } from './get-month-canceled-orders-amount'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import dayjs from 'dayjs'

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    })),
  },
}))

describe('GET /metrics/month-canceled-orders-amount', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', function () {
      return Promise.resolve('rest-1')
    })

    await getMonthCanceledOrdersAmount(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return correct amount and diffFromLastMonth', async () => {
  const today = dayjs()
  const lastMonth = today.subtract(1, 'month')
  const lastMonthWithYear = lastMonth.format('YYYY-MM')
  const currentMonthWithYear = today.format('YYYY-MM')

  const mockOrders = [
    { monthWithYear: lastMonthWithYear, amount: 4 },
    { monthWithYear: currentMonthWithYear, amount: 6 },
  ]

  const selectMock = db.select as unknown as ReturnType<typeof vi.fn>
  const fromMock = vi.fn().mockReturnThis()
  const whereMock = vi.fn().mockReturnThis()
  const groupByMock = vi.fn().mockReturnThis()
  const havingMock = vi.fn().mockResolvedValueOnce(mockOrders)
  selectMock.mockReturnValue({
    from: fromMock,
    where: whereMock,
    groupBy: groupByMock,
    having: havingMock,
  })

  const response = await app.inject({
    method: 'GET',
    url: '/metrics/month-canceled-orders-amount',
  })

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({
    amount: 6,
    diffFromLastMonth: 50,
  })
})

  it('should return amount 0 and diffFromLastMonth 0 when no data exists', async () => {
    const selectMock = db.select as unknown as ReturnType<typeof vi.fn>
    const fromMock = vi.fn().mockReturnThis()
    const whereMock = vi.fn().mockReturnThis()
    const groupByMock = vi.fn().mockReturnThis()
    const havingMock = vi.fn().mockResolvedValueOnce([])
    selectMock.mockReturnValue({
      from: fromMock,
      where: whereMock,
      groupBy: groupByMock,
      having: havingMock,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-canceled-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 0,
      diffFromLastMonth: 0,
    })
  })

  it('should return 500 if something goes wrong', async () => {
    const selectMock = db.select as unknown as ReturnType<typeof vi.fn>
    const fromMock = vi.fn().mockReturnThis()
    const whereMock = vi.fn().mockReturnThis()
    const groupByMock = vi.fn().mockReturnThis()
    const havingMock = vi.fn().mockRejectedValueOnce(new Error('DB Failure'))
    selectMock.mockReturnValue({
      from: fromMock,
      where: whereMock,
      groupBy: groupByMock,
      having: havingMock,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-canceled-orders-amount',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'DB Failure',
    })
  })
})
