import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerRestaurant } from './register-restaurant'
import { fastify } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { users, restaurants } from '@/db/schema'

vi.mock('@/db/connection', () => ({
  db: {},
}))

describe('registerRestaurant', () => {
  let app: ReturnType<typeof fastify>

  beforeEach(async () => {
    vi.clearAllMocks()

    const returningMock = vi.fn().mockResolvedValueOnce([{ id: 'manager-id' }])

    ;(db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: returningMock,
      })),
    }))

    app = fastify()

    app.setErrorHandler((error: { issues: any }, _: any, reply: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: { message: string; issues?: z.ZodIssue[] }): any; new(): any } } }) => {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ message: 'Validation error', issues: error.issues })
      }

      return reply.status(500).send({ message: 'Internal server error' })
    })

    await registerRestaurant(app)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('must register a restaurant successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/restaurants',
      payload: {
        restaurantName: 'Test Restaurant',
        managerName: 'John Doe',
        phone: '123456789',
        email: 'john.doe@email.com',
      },
    })

    expect(response.statusCode).toBe(204)
    expect((db.insert as any).mock.calls[0][0]).toBe(users)
    expect((db.insert as any).mock.calls[1][0]).toBe(restaurants)
  })

  it('must return error 400 if the request body is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/restaurants',
      payload: {
        restaurantName: 'Test Restaurant',
        managerName: 'John Doe',
        phone: '123456789',
      },
    })

    expect(response.statusCode).toBe(400)
  })
})
