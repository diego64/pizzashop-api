import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance, FastifyReply } from 'fastify'
import { db } from '../../db/connection'
import { orders } from '../../db/schema'
import { eq, sql, desc } from 'drizzle-orm'

const fakeOrders = [
  {
    id: 1,
    status: 'pending',
    total: 20,
    createdAt: new Date().toISOString(),
    restaurantId: 'restaurant-123',
  },
]

describe('GET /orders', () => {
  let app: FastifyInstance
  const mockGetManagedRestaurantId = vi.fn()

  const originalConsoleError = console.error
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn

  beforeEach(async () => {
    // Silencia logs
    console.error = vi.fn()
    console.log = vi.fn()
    console.warn = vi.fn()

    app = Fastify()

    app.decorate('authenticate', async (request: any, _reply: FastifyReply) => {
      request.user = { sub: 'user-123', role: 'restaurant_manager' }
    })

    app.decorateRequest('getManagedRestaurantId', async function () {
      return ''
    })

    app.addHook('preHandler', (request: any, _reply, done) => {
      request.getManagedRestaurantId = mockGetManagedRestaurantId
      done()
    })

    app.get(
      '/orders',
      { preHandler: [app.authenticate] },
      async (request: any, reply: FastifyReply) => {
        const pageIndex = Number(request.query.pageIndex)
        if (Number.isNaN(pageIndex) || pageIndex < 0) {
          return reply.status(400).send({ error: 'Invalid query parameters' })
        }

        const restaurantId = await request.getManagedRestaurantId()
        if (!restaurantId) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'User is not a restaurant manager.',
          })
        }

        try {
          const totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(orders)
            .where(eq(orders.restaurantId, restaurantId))

          const totalCount = Number(totalCountResult[0]?.count) || 0

          const ordersResult = await db
            .select()
            .from(orders)
            .where(eq(orders.restaurantId, restaurantId))
            .orderBy(desc(orders.createdAt))
            .offset(pageIndex * 10)
            .limit(10)

          return {
            orders: ordersResult,
            metadata: { totalCount, pageIndex },
          }
        } catch (error: any) {
          return reply.status(500).send({ error: error.message || 'Internal Server Error' })
        }
      },
    )

    const countQueryBuilder = {
      from() {
        return this
      },
      where() {
        return this
      },
      then(resolve: (value: any) => void) {
        return Promise.resolve([{ count: 1 }]).then(resolve)
      },
    }

    const ordersQueryBuilder = {
      from() {
        return this
      },
      where() {
        return this
      },
      orderBy() {
        return this
      },
      offset() {
        return this
      },
      limit() {
        return this
      },
      then(resolve: (value: any) => void) {
        return Promise.resolve(fakeOrders).then(resolve)
      },
    }

    vi.spyOn(db, 'select').mockImplementation((args?: any) => {
      if (args && 'count' in args) {
        return countQueryBuilder as any
      }
      return ordersQueryBuilder as any
    })

    mockGetManagedRestaurantId.mockResolvedValue('restaurant-123')

    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    console.error = originalConsoleError
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    if (app) await app.close()
  })

  it('should return orders list with metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders?pageIndex=0',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      orders: fakeOrders,
      metadata: { totalCount: 1, pageIndex: 0 },
    })
  })

  it('should return 401 if user is not a restaurant manager', async () => {
    mockGetManagedRestaurantId.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/orders?pageIndex=0',
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'User is not a restaurant manager.',
    })
  })

  it('should return 400 if pageIndex is invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders?pageIndex=-1',
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Invalid query parameters')
  })

  it('should return 400 if pageIndex is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Invalid query parameters')
  })
})
