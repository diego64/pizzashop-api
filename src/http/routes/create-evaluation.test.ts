import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { createEvaluation } from './create-evaluation'
import { db } from '@/db/connection'
import { evaluations } from '@/db/schema'

vi.mock('@/db/connection', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
}))

describe('createEvaluation route', () => {
  let app: FastifyInstance
  let currentUser: { sub: string }

  beforeEach(async () => {
    app = fastify()

    currentUser = { sub: 'user-1' }

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getCurrentUser', async function () {
      return currentUser
    })

    await createEvaluation(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should create evaluation and return 201', async () => {
    const mockValues = vi.fn()
    vi.mocked(db.insert).mockReturnValueOnce({ values: mockValues } as any)

    const payload = {
      restaurantId: 'rest-123',
      rate: 4,
      comment: 'Very good!',
    }

    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      payload,
    })

    expect(response.statusCode).toBe(201)
    expect(db.insert).toHaveBeenCalledWith(evaluations)
    expect(mockValues).toHaveBeenCalledWith({
      restaurantId: payload.restaurantId,
      customerId: currentUser.sub,
      rate: payload.rate,
      comment: payload.comment,
    })
  })

  it('should return 400 if rate is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      payload: {
        restaurantId: 'rest-123',
        comment: 'no rating',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should return 400 if rate is less than 1', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      payload: {
        restaurantId: 'rest-123',
        rate: 0,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should return 400 if rate is more than 5', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      payload: {
        restaurantId: 'rest-123',
        rate: 6,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('should accept evaluation without comment', async () => {
    const mockValues = vi.fn()
    vi.mocked(db.insert).mockReturnValueOnce({ values: mockValues } as any)

    const payload = {
      restaurantId: 'rest-456',
      rate: 5,
    }

    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      payload,
    })

    expect(response.statusCode).toBe(201)
    expect(db.insert).toHaveBeenCalledWith(evaluations)
    expect(mockValues).toHaveBeenCalledWith({
      restaurantId: payload.restaurantId,
      customerId: currentUser.sub,
      rate: payload.rate,
      comment: undefined,
    })
  })
})
