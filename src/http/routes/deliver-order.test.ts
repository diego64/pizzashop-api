import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { deliverOrder } from './deliver-order'
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
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}))

describe('deliverOrder route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', async function () {
      return 'rest-123'
    })

    await deliverOrder(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should deliver the order and return 204 if status is delivering', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      restaurantId: 'rest-123',
      status: 'delivering',
      createdAt: null,
      customerId: '',
      totalInCents: 0
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/deliver',
    })

    expect(response.statusCode).toBe(204)
    expect(db.query.orders.findFirst).toHaveBeenCalled()
    expect(db.update).toHaveBeenCalled()
  })

  it('should return 400 if order status is not delivering', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-2',
      restaurantId: 'rest-123',
      status: 'delivered',
      createdAt: null,
      customerId: '',
      totalInCents: 0
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-2/deliver',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ message: 'O pedido já foi entregue.' })
  })

  it('should throw UnauthorizedError if order does not belong to restaurant', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-999/deliver',
    })

    expect(response.statusCode).toBe(500)
    expect(response.body).toContain(UnauthorizedError.prototype.name)
  })
})
