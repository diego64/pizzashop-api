import Fastify from 'fastify'
import supertest from 'supertest'
import { describe, it, afterEach, expect, vi } from 'vitest'
import { getPopularProducts } from './get-popular-products'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { product: 'Pizza Margherita', amount: 10 },
      { product: 'Calabresa', amount: 8 },
    ]),
  },
}))

describe('GET /metrics/popular-products', () => {
  let app: ReturnType<typeof Fastify>

  function buildApp(authenticateImpl: any) {
    const instance = Fastify()
    instance.decorate('authenticate', authenticateImpl)

    instance.setErrorHandler((error, _request, reply) => {
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        reply.status(error.statusCode).send({ message: error.message })
      } else if (error.name === 'UnauthorizedError') {
        reply.status(401).send({ message: error.message })
      } else {
        reply.status(500).send({ message: 'Internal Server Error' })
      }
    })

    getPopularProducts(instance)
    return instance
  }

  afterEach(async () => {
    if (app) await app.close()
    vi.resetAllMocks()
  })

  it('should return popular products with status 200', async () => {
    app = buildApp(async (request: any, _reply: any) => {
      request.user = { sub: 'user-123', role: 'restaurant_manager' }
      request.getManagedRestaurantId = async () => 'restaurant-123'
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/metrics/popular-products')
      .expect(200)

    expect(response.body).toEqual([
      { product: 'Pizza Margherita', amount: 10 },
      { product: 'Calabresa', amount: 8 },
    ])
  })

  it('should return 401 if user is unauthorized', async () => {
    app = buildApp(async (request: any, _reply: any) => {
      request.user = { sub: 'user-123', role: 'restaurant_manager' }
      request.getManagedRestaurantId = async () => null
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/metrics/popular-products')
      .expect(401)

    expect(response.body.message).toMatch(/not authorized/i)
  })

  it('should return 500 if DB query fails', async () => {
    vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('DB error')
    })

    app = buildApp(async (request: any, _reply: any) => {
      request.user = { sub: 'user-123', role: 'restaurant_manager' }
      request.getManagedRestaurantId = async () => 'restaurant-123'
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/metrics/popular-products')
      .expect(500)

    expect(response.body.message).toBe('An error occurred while fetching popular products.')
  })
})
