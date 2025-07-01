import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { cancelOrder } from './cancel-order'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { UnauthorizedError } from './errors/unauthorized-error'
import { eq } from 'drizzle-orm'

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

describe('cancelOrder route', () => {
  let app: FastifyInstance
  let currentUser: { restaurantId?: string }

  beforeEach(async () => {
    app = fastify()

    currentUser = { restaurantId: undefined }

    app.decorateRequest('getCurrentUser', async function () {
      return { sub: 'test-user', ...currentUser }
    })

    app.decorate('authenticate', async () => {})

    app.setErrorHandler((error, request, reply) => {
      if (error instanceof UnauthorizedError) {
        reply.status(401).send({ message: error.message })
      } else {
        reply.status(500).send({ message: error.message })
      }
    })

    await cancelOrder(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return 401 if user is not a restaurant manager', async () => {
    currentUser.restaurantId = undefined

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/cancel',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      message: 'User is not a restaurant manager.',
    })
  })

  it('should return 401 if order does not belong to user-managed restaurant', async () => {
    currentUser.restaurantId = 'rest-1'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/cancel',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      message: 'Order not found under the user managed restaurant.',
    })
  })

  it('should return 400 if order status is not cancelable', async () => {
    currentUser.restaurantId = 'rest-1'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      restaurantId: 'rest-1',
      status: 'delivered',
      createdAt: null,
      customerId: '',
      totalInCents: 0
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/cancel',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'STATUS_NOT_VALID',
      message: 'O pedido não pode ser cancelado depois de ser enviado.',
    })
  })

  it('should cancel the order and return 204 when status is valid', async () => {
    currentUser.restaurantId = 'rest-1'

    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      restaurantId: 'rest-1',
      status: 'pending',
      createdAt: null,
      customerId: '',
      totalInCents: 0
    })

    const mockWhere = vi.fn()
    vi.mocked(db.update).mockReturnValueOnce({
      set: () => ({ where: mockWhere }),
    } as any)

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/cancel',
    })

    expect(response.statusCode).toBe(204)
    expect(db.update).toHaveBeenCalledWith(orders)
    expect(mockWhere).toHaveBeenCalledWith(eq(orders.id, 'order-1'))
  })

  it('should return 500 if an unexpected error happens', async () => {
    currentUser.restaurantId = 'rest-1'

    // Simula falha no banco
    vi.mocked(db.query.orders.findFirst).mockImplementation(() => {
      throw new Error('Unexpected DB failure')
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/cancel',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      message: 'Unexpected DB failure',
    })
  })
})
