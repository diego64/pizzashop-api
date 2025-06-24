import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fastify } from 'fastify'
import { approveOrder } from './approve-order'
import { db } from '@/db/connection'
import { UnauthorizedError } from './errors/unauthorized-error'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}))

describe('approveOrder route', () => {
  let app: ReturnType<typeof fastify>
  let currentRestaurantId = 'default-restaurant-id'

  beforeEach(async () => {
    app = fastify()

    // Define o decorator antes de app.ready()
    app.decorateRequest('getManagedRestaurantId', async function () {
      return currentRestaurantId
    })

    app.decorate('authenticate', async (request: any, reply: any) => {})

    await approveOrder(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    currentRestaurantId = 'default-restaurant-id'
    await app.close()
  })

  it('should return 204 when order is approved successfully', async () => {
    currentRestaurantId = 'resto-1'
    const orderId = 'order-1'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: orderId,
      restaurantId: currentRestaurantId,
      status: 'pending',
      createdAt: null,
      customerId: '',
      totalInCents: 0,
    })

    const response = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/approve`,
    })

    expect(response.statusCode).toBe(204)
  })

  it('should return 400 if order was already approved', async () => {
    currentRestaurantId = 'resto-1'
    const orderId = 'order-1'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: orderId,
      restaurantId: currentRestaurantId,
      status: 'processing',
      createdAt: null,
      customerId: '',
      totalInCents: 0,
    })

    const response = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/approve`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      message: 'Order was already approved before.',
    })
  })

  it('should throw UnauthorizedError if order does not belong to restaurant', async () => {
    currentRestaurantId = 'resto-1'
    const orderId = 'order-404'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined)

    // Verifica se o erro lançado é UnauthorizedError (exemplo)
    try {
      await app.inject({
        method: 'PATCH',
        url: `/orders/${orderId}/approve`,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
      expect((err as UnauthorizedError).message).toBe('Unauthorized')
    }

    // Verifica a resposta HTTP
    const response = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/approve`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.body).toContain('Unauthorized')
  })
})
