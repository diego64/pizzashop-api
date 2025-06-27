import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { getMonthOrdersAmount } from './get-month-orders-amount'
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

describe('GET /metrics/month-orders-amount', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()

    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = {
        sub: 'user-123',
        email: 'admin@restaurant.com',
      }
    })

    app.decorateRequest('getManagedRestaurantId', null)

    app.addHook('onRequest', async (request: any) => {
      request.getManagedRestaurantId = mockGetManagedRestaurantId
    })

    getMonthOrdersAmount(app)
    await app.ready()

    vi.clearAllMocks()
  })

  it('retorna amount e diff corretamente quando há dados', async () => {
    const now = new Date()
    const lastMonth = new Date(now)
    lastMonth.setMonth(now.getMonth() - 1)

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const previousMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    mockGetManagedRestaurantId.mockResolvedValue('restaurant-123')

    mockDbSelect.mockResolvedValue([
      { monthWithYear: previousMonth, amount: 10 },
      { monthWithYear: currentMonth, amount: 20 },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 20,
      diffFromLastMonth: 100,
    })
  })

  it('retorna amount 0 e diff 0 quando não há pedidos', async () => {
    mockGetManagedRestaurantId.mockResolvedValue('restaurant-123')

    mockDbSelect.mockResolvedValue([])

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-orders-amount',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      amount: 0,
      diffFromLastMonth: 0,
    })
  })

  it('retorna erro 500 quando getManagedRestaurantId falha', async () => {
    mockGetManagedRestaurantId.mockRejectedValue(new Error('Erro interno'))

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/month-orders-amount',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'Erro interno',
    })
  })
})
