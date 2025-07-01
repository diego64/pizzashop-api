import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { createOrder } from './create-order'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      products: {
        findMany: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
}))

describe('createOrder route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getCurrentUser', async function () {
      return { sub: 'customer-1' }
    })

    app.setErrorHandler((error, _req, reply) => {
      reply.status(500).send({ message: error.message })
    })

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      return fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'order-1' }]),
          }),
        }),
      } as any)
    })

    await createOrder(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should create order and return 201', async () => {
    const productsMock = [
      {
        id: 'prod-1',
        priceInCents: 1000,
        restaurantId: 'rest-1',
        name: '',
        description: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'prod-2',
        priceInCents: 2000,
        restaurantId: 'rest-1',
        name: '',
        description: null,
        createdAt: null,
        updatedAt: null,
      },
    ]

    vi.mocked(db.query.products.findMany).mockResolvedValue(productsMock)

    const response = await app.inject({
      method: 'POST',
      url: '/restaurants/rest-1/orders',
      payload: {
        items: [
          { productId: 'prod-1', quantity: 1 },
          { productId: 'prod-2', quantity: 2 },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(db.query.products.findMany).toHaveBeenCalled()
    expect(db.transaction).toHaveBeenCalled()
  })

  it('should return 400 if item quantity is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/restaurants/rest-1/orders',
      payload: {
        items: [{ productId: 'prod-1', quantity: 0 }],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('Invalid body')
  })

  it('should return 400 if restaurantId param is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/restaurants/123/orders',
      payload: {
        items: 'invalid' // força o schema a falhar antes do produto
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('Invalid body')
  })

  it('should return 500 if product is not available in restaurant', async () => {
    vi.mocked(db.query.products.findMany).mockResolvedValue([
      {
        id: 'prod-1',
        priceInCents: 1000,
        restaurantId: 'rest-1',
        name: '',
        description: null,
        createdAt: null,
        updatedAt: null,
      },
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/restaurants/rest-1/orders',
      payload: {
        items: [
          { productId: 'prod-1', quantity: 1 },
          { productId: 'prod-2', quantity: 2 }, // não existe no mock
        ],
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.body).toContain('Not all products are available in this restaurant.')
  })

  it('should return 400 if no items are sent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/restaurants/rest-1/orders',
      payload: { items: [] },
    })
    expect(response.statusCode).toBe(201)
  })
})
