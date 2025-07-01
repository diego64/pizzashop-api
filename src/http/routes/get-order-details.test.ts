import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { NotAManagerError } from './errors/not-a-manager-error'
import { UnauthorizedError } from './errors/unauthorized-error'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn() as unknown as (...args: any[]) => any,
      },
    },
  },
}))

function getOrderDetails(app: ReturnType<typeof Fastify>) {
  const paramsSchema = z.object({
    id: z.string().nonempty().transform((str) => str.trim()).refine((val) => val.length > 0, {
      message: 'id cannot be empty or blank',
    }),
  })

  app.route({
    method: 'GET',
    url: '/orders/:id',
    preHandler: [app.authenticate],
    handler: async (request: any, reply: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: { message: string }): any; new(): any } } }) => {
      try {
        const { id } = paramsSchema.parse(request.params)
        const currentUser = await request.getCurrentUser()

        if (!currentUser.restaurantId) {
          throw new NotAManagerError()
        }

        // Busca pedido no banco
        const order = await db.query.orders.findFirst({
          where: (orders: { id: any; restaurantId: any }, { eq, and }: any) =>
            and(eq(orders.id, id), eq(orders.restaurantId, currentUser.restaurantId)),
          include: {
            customer: true,
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        } as any)

        if (!order) {
          throw new UnauthorizedError()
        }

        return order
      } catch (err) {
        if (err instanceof NotAManagerError || err instanceof UnauthorizedError) {
          throw err
        }
        // Erro de validação do Zod retorna 400
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ message: err.errors.map(e => e.message).join(', ') })
        }
        // Erro inesperado
        throw err
      }
    },
  })
}

describe('GET /orders/:id - full coverage', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()

    app.decorate('authenticate', async (request: any) => {
      request.user = { sub: 'user-123', email: 'admin@example.com' }
    })

    app.decorateRequest('getCurrentUser', async function () {
      return { restaurantId: 'restaurant-123' }
    })

    app.setErrorHandler((error: any, _request: any, reply: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: { message: any }): any; new(): any } } }) => {
      if (error instanceof NotAManagerError) {
        return reply.status(403).send({ message: 'User is not a manager' })
      }
      if (error instanceof UnauthorizedError) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      return reply.status(500).send({ message: error.message || 'Internal Server Error' })
    })

    getOrderDetails(app)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should return 404 for /orders (missing id param)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders', // rota inválida sem id
    })
    expect(res.statusCode).toBe(404)
  })

  it('should return 400 if id param is empty or blank', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders/ ', // espaço em branco no id
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('message')
  })

  it('should return 403 if user does not have restaurantId (NotAManagerError)', async () => {
    const localApp = Fastify()

    localApp.decorate('authenticate', async (request: any) => {
      request.user = { sub: 'user-123', email: 'admin@example.com' }
    })

    localApp.decorateRequest('getCurrentUser', async function () {
      return { sub: 'user-123' } // sem restaurantId
    })

    localApp.setErrorHandler((error: any, _req, reply) => {
      if (error instanceof NotAManagerError) {
        return reply.status(403).send({ message: 'User is not a manager' })
      }
      if (error instanceof UnauthorizedError) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      return reply.status(500).send({ message: error.message || 'Internal Server Error' })
    })

    getOrderDetails(localApp)
    await localApp.ready()

    const res = await localApp.inject({
      method: 'GET',
      url: '/orders/some-id',
    })

    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ message: 'User is not a manager' })

    await localApp.close()
  })

  it('should return 401 if order not found (UnauthorizedError)', async () => {
    ;(db.query.orders.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/orders/existing-id',
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ message: 'Unauthorized' })
  })

  it('should return 200 and order data if order found', async () => {
    const fakeOrder = {
      id: 'existing-id',
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
          product: { name: 'Pizza' },
        },
      ],
    }

    ;(db.query.orders.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(fakeOrder)

    const res = await app.inject({
      method: 'GET',
      url: '/orders/existing-id',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(fakeOrder)
  })

  it('should return 500 if database throws error', async () => {
    ;(db.query.orders.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB failure'))

    const res = await app.inject({
      method: 'GET',
      url: '/orders/existing-id',
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ message: 'DB failure' })
  })
})
