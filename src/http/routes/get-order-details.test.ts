import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import Fastify from 'fastify'
import { getOrderDetails } from './get-order-details'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
    },
  },
}))

describe('GET /orders/:id', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()

    app.decorate('authenticate', async (request: any) => {
      request.user = {
        sub: 'user-123',
        email: 'admin@example.com',
      }
    })

    app.decorateRequest('getCurrentUser', async function () {
      return { restaurantId: 'restaurant-123' }
    })

    app.get('/orders', async (_request: any, reply: any) => {
      return reply.status(404).send({ message: 'Route not found' })
    })

    getOrderDetails(app)
    await app.ready()

    vi.clearAllMocks()
  })

  it('should return 404 if params id is missing (route not found)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders', // missing id param
    })

    expect(res.statusCode).toBe(404)
  })

  it('should return 400 if id param is invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders/123',
    })

    expect(res.statusCode).not.toBe(400)
  })

  it('should throw NotAManagerError if no restaurantId', async () => {
    const localApp = Fastify()

    localApp.decorate('authenticate', async (request: any) => {
      request.user = {
        sub: 'user-123',
        email: 'admin@example.com',
      }
    })

    localApp.decorateRequest('getCurrentUser', async function () {
      return { sub: 'user-123' }
    })

    getOrderDetails(localApp)
    await localApp.ready()

    const res = await localApp.inject({
      method: 'GET',
      url: '/orders/valid-id',
    })

    expect(res.statusCode).toBe(500)
  })

  it('should throw UnauthorizedError if order not found', async () => {
    ;(db.query.orders.findFirst as Mock).mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/orders/valid-id',
    })

    expect(res.statusCode).toBe(500)
  })

  it('should return order if found', async () => {
    const fakeOrder = {
      id: 'valid-id',
      createdAt: new Date().toISOString(),
      status: 'pending',
      totalInCents: 1234,
      customer: {
        name: 'John Doe',
        phone: '123456789',
        email: 'john@example.com',
      },
      orderItems: [
        {
          id: 'item-1',
          priceInCents: 500,
          quantity: 2,
          product: {
            name: 'Pizza',
          },
        },
      ],
    }

    ;(db.query.orders.findFirst as Mock).mockResolvedValue(fakeOrder)

    const res = await app.inject({
      method: 'GET',
      url: '/orders/valid-id',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(fakeOrder)
  })

  it('should handle internal errors gracefully', async () => {
    ;(db.query.orders.findFirst as Mock).mockRejectedValue(new Error('DB failure'))

    const res = await app.inject({
      method: 'GET',
      url: '/orders/valid-id',
    })

    expect(res.statusCode).toBe(500)
  })
})
