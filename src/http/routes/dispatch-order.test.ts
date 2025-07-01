import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { dispatchOrder } from './dispatch-order'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
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

describe('dispatchOrder route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', async function () {
      return 'rest-123'
    })

    // Adiciona o error handler, necessário para testar UnauthorizedError e fallback
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof UnauthorizedError) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }

      return reply.status(500).send({ message: error.message })
    })

    await dispatchOrder(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return 204 when order is dispatched successfully', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      restaurantId: 'rest-123',
      status: 'processing',
      createdAt: null,
      customerId: '',
      totalInCents: 0,
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/dispatch',
    })

    expect(response.statusCode).toBe(204)
    expect(db.query.orders.findFirst).toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledWith(orders)
  })

  it('should return 401 if order is not found for the restaurant', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-x/dispatch',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ message: 'Unauthorized' })
  })

  it('should return 400 if order is not in processing status', async () => {
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-2',
      restaurantId: 'rest-123',
      status: 'delivering',
      createdAt: null,
      customerId: '',
      totalInCents: 0,
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-2/dispatch',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      message: 'O pedido já foi enviado ao cliente.',
    })
  })

  it('should return 500 if an unexpected error is thrown', async () => {
    // Simula erro interno inesperado
    vi.mocked(db.query.orders.findFirst).mockImplementation(() => {
      throw new Error('Unexpected failure')
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/orders/order-error/dispatch',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ message: 'Unexpected failure' })
  })
})
