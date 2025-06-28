import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { updateMenu } from './update-menu'
import { db } from '@/db/connection'
import { UnauthorizedError } from './errors/unauthorized-error'
import { z } from 'zod'

vi.mock('@/db/connection', () => ({
  db: {
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}))

const createTestApp = async (mockGetManagerId: () => Promise<string>) => {
  const app = fastify()

  app.setErrorHandler((error, _, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'Validation error', issues: error.issues })
    }
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({ message: error.message })
    }
    return reply.status(500).send({ message: 'Internal server error' })
  })

  app.decorate('authenticate', async () => {})
  app.decorateRequest('getManagedRestaurantId', mockGetManagerId)

  await updateMenu(app)
  await app.ready()
  return app
}

describe('updateMenu route', () => {
  let app: FastifyInstance
  const RESTAURANT_ID = 'rest-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (app) await app.close()
  })

  it('should update new products, edited products and delete specified products', async () => {
    app = await createTestApp(async () => RESTAURANT_ID)

    const payload = {
      products: {
        newOrUpdatedProducts: [
          { id: 'p1', name: 'Prod 1', description: 'Desc1', price: 1.5 },
          { name: 'NewProd', description: 'NewDesc', price: 2.0 },
        ],
        deletedProductIds: ['p2'],
      },
    }

    const resp = await app.inject({
      method: 'PUT',
      url: '/menu',
      payload,
    })

    expect(resp.statusCode).toBe(204)
    expect(db.delete).toHaveBeenCalledOnce()
    expect(db.update).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalledOnce()
  })

  it('should return 204 and do nothing for empty lists', async () => {
    app = await createTestApp(async () => RESTAURANT_ID)

    const payload = {
      products: {
        newOrUpdatedProducts: [],
        deletedProductIds: [],
      },
    }

    const resp = await app.inject({
      method: 'PUT',
      url: '/menu',
      payload,
    })

    expect(resp.statusCode).toBe(204)
    expect(db.delete).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('should return 401 if not a manager', async () => {
    app = await createTestApp(async () => '') // simula sem permissão

    const resp = await app.inject({
      method: 'PUT',
      url: '/menu',
      payload: {
        products: {
          newOrUpdatedProducts: [],
          deletedProductIds: [],
        },
      },
    })

    expect(resp.statusCode).toBe(401)
    const body = await resp.json()
    expect(body.message).toBe('User is not a restaurant manager.')
  })

  it('should return 500 on runtime validation error (missing price)', async () => {
    app = await createTestApp(async () => RESTAURANT_ID)

    const resp = await app.inject({
      method: 'PUT',
      url: '/menu',
      payload: {
        products: {
          newOrUpdatedProducts: [{ name: 'BadProd' }], // falta 'price'
          deletedProductIds: [],
        },
      },
    })

    expect(resp.statusCode).toBe(500)
    const body = await resp.json()
    expect(body.message).toBe('Internal server error')
  })
})
