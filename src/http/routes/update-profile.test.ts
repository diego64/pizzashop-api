import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { UnauthorizedError } from './errors/unauthorized-error'
import { db } from '@/db/connection'
import { restaurants } from '@/db/schema'
import fastify from 'fastify'
import { eq } from 'drizzle-orm'

vi.mock('@/db/connection', () => {
  const mockExecute = vi.fn().mockResolvedValue(undefined)
  const mockWhere = vi.fn().mockReturnValue({ execute: mockExecute })
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

  return {
    db: {
      update: mockUpdate,
      __mocks: { mockUpdate, mockSet, mockWhere, mockExecute }
    }
  }
})

interface DbMocks {
  mockUpdate: ReturnType<typeof vi.fn>
  mockSet: ReturnType<typeof vi.fn>
  mockWhere: ReturnType<typeof vi.fn>
  mockExecute: ReturnType<typeof vi.fn>
}

const createTestApp = async (mockGetManagerId: () => Promise<string | null>) => {
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

  app.put('/profile', async (request, reply) => {
    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
    })

    const payload = schema.parse(request.body)

    const restaurantId = await mockGetManagerId()
    if (!restaurantId) throw new UnauthorizedError('Unauthorized')

    await db
      .update(restaurants)
      .set(payload)
      .where(eq(restaurants.id, restaurantId))
      .execute()

    return reply.status(204).send()
  })

  await app.ready()
  return app
}

describe('Update profile route', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should update the profile successfully and return 204', async () => {
    app = await createTestApp(async () => 'some-restaurant-id')

    const payload = {
      name: 'New Restaurant Name',
      description: 'Updated description',
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload,
    })

    expect(response.statusCode).toBe(204)

    const { mockUpdate, mockSet, mockWhere, mockExecute } = (db as unknown as { __mocks: DbMocks }).__mocks

    expect(mockUpdate).toHaveBeenCalledWith(restaurants)
    expect(mockSet).toHaveBeenCalledWith(payload)
    expect(mockWhere).toHaveBeenCalled()
    expect(mockExecute).toHaveBeenCalled()
  })

  it('should update the profile when description is not provided', async () => {
    app = await createTestApp(async () => 'some-restaurant-id')

    const payload = {
      name: 'Only Name',
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload,
    })

    expect(response.statusCode).toBe(204)

    const { mockSet } = (db as unknown as { __mocks: DbMocks }).__mocks
    expect(mockSet).toHaveBeenCalledWith({ name: 'Only Name' })
  })

  it('should return 400 if payload is invalid', async () => {
    app = await createTestApp(async () => 'some-restaurant-id')

    const invalidPayload = {
      name: 123,
      description: 456,
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload: invalidPayload,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('message')
    expect(response.json().message).toMatch(/Validation error/i)
  })

  it('should return 400 if name is missing from payload', async () => {
    app = await createTestApp(async () => 'some-restaurant-id')

    const payload = {
      description: 'Only description',
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toMatch(/Validation error/i)
  })

  it('should return 401 if restaurantId is missing', async () => {
    app = await createTestApp(async () => null)

    const payload = {
      name: 'Name',
      description: 'Description',
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toHaveProperty('message', 'Unauthorized')
  })

  it('should return 500 if database throws an error', async () => {
    const { mockExecute } = (db as unknown as { __mocks: DbMocks }).__mocks
    mockExecute.mockRejectedValueOnce(new Error('DB failure'))

    app = await createTestApp(async () => 'some-restaurant-id')

    const payload = {
      name: 'Test Name',
      description: 'Test Description',
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toHaveProperty('message', 'Internal server error')
  })
})
