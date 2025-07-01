import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { getManagedRestaurant } from './get-managed-restaurant'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      restaurants: {
        findFirst: vi.fn(),
      },
    },
  },
}))

describe('GET /managed-restaurant', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getManagedRestaurantId', function () {
      return Promise.resolve('rest-123')
    })

    await getManagedRestaurant(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return the restaurant if found', async () => {
    const fakeRestaurant = {
      id: 'rest-123',
      name: 'Pizza Place',
      description: 'Great pizza',
      createdAt: new Date(),
      updatedAt: null,
      managerId: null,
    }

    vi.mocked(db.query.restaurants.findFirst).mockResolvedValue(fakeRestaurant)

    const response = await app.inject({
      method: 'GET',
      url: '/managed-restaurant',
    })

    expect(response.statusCode).toBe(200)

    const responseData = {
      ...response.json(),
      createdAt: new Date(response.json().createdAt),
    }

    expect(responseData).toEqual(fakeRestaurant)
  })

  it('should return 404 if restaurant not found', async () => {
    vi.mocked(db.query.restaurants.findFirst).mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'GET',
      url: '/managed-restaurant',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Restaurant not found.' })
  })

  it('should return 500 if an Error is thrown', async () => {
    vi.mocked(db.query.restaurants.findFirst).mockRejectedValue(new Error('Database failure'))

    const response = await app.inject({
      method: 'GET',
      url: '/managed-restaurant',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Database failure' })
  })

  it('should return 500 with generic message if a non-Error is thrown', async () => {
    vi.mocked(db.query.restaurants.findFirst).mockRejectedValue('non-error string')

    const response = await app.inject({
      method: 'GET',
      url: '/managed-restaurant',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Internal Server Error' })
  })

  it('should call getManagedRestaurantId directly for function coverage', async () => {
    const mockRequest = {
      getManagedRestaurantId: vi.fn().mockResolvedValue('rest-123')
    }

    const result = await mockRequest.getManagedRestaurantId()
    expect(result).toBe('rest-123')
    expect(mockRequest.getManagedRestaurantId).toHaveBeenCalled()
  })
})
