import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { getMonthReceipt } from './get-month-receipt'
import { db } from '@/db/connection'

const mockDbSelect = vi.fn()

vi.mock('@/db/connection', () => ({
  db: {
    select: (...args: any[]) => {
      return {
        from: () => ({
          where: () => ({
            groupBy: () => ({
              having: mockDbSelect,
            }),
          }),
        }),
      }
    },
  },
}))

const mockGetManagedRestaurantId = vi.fn()

describe('GET /metrics/month-receipt', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()

    app.decorate('authenticate', async (request: any) => {
      request.user = {
        sub: 'user-123',
        email: 'admin@restaurant.com',
      }
    })

    app.decorateRequest('getManagedRestaurantId', null)

    app.addHook('onRequest', async (request: any) => {
      request.getManagedRestaurantId = mockGetManagedRestaurantId
    })

    getMonthReceipt(app)
    await app.ready()

    vi.clearAllMocks()
  })

  it('returns the receipt and diff correctly when there is data', async () => {
    const now = new Date()
    const lastMonth = new Date(now)
    lastMonth.setMonth(now.getMonth() - 1)

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const previousMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    mockGetManagedRestaurantId.mockResolvedValue('restaurant-123')

    mockDbSelect.mockResolvedValue([
      { monthWithYear: previousMonth, receipt: 5000 }, // R$50,00
      { monthWithYear: currentMonth, receipt: 10000 }, // R$100,00
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-receipt',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      receipt: 10000,
      diffFromLastMonth: 100, // 100% de aumento
    })
  })

  it('returns receipt 0 and diff 0 when there is no data', async () => {
    mockGetManagedRestaurantId.mockResolvedValue('restaurant-123')

    mockDbSelect.mockResolvedValue([])

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-receipt',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      receipt: 0,
      diffFromLastMonth: 0,
    })
  })

  it('returns error 500 when getManagedRestaurantId fails', async () => {
    mockGetManagedRestaurantId.mockRejectedValue(new Error('Internal error'))

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-receipt',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'Internal error',
    })
  })
})
