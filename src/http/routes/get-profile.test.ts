import Fastify from 'fastify'
import supertest from 'supertest'
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { getProfile } from './get-profile'
import { db } from '@/db/connection'
import { UnauthorizedError } from './errors/unauthorized-error'

interface User {
  id: string
  name: string
  email: string
}

const mockUser: User = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john.doe@example.com',
}

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}))

describe('GET /me', () => {
  let app: ReturnType<typeof Fastify>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    if (app) await app.close()
    vi.resetAllMocks()
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  function buildApp(authenticateImpl: any) {
    const instance = Fastify()

    instance.decorate('authenticate', authenticateImpl)

    instance.setErrorHandler((error, request, reply) => {
      if (error instanceof UnauthorizedError) {
        reply.status(401).send({ message: error.message })
      } else {
        reply.status(500).send({ message: 'An error occurred while fetching user profile.' })
      }
    })

    getProfile(instance)
    return instance
  }

  it('should return user profile with status 200', async () => {
    (db.query.users.findFirst as any).mockResolvedValue(mockUser)

    app = buildApp(async (request: any, _reply: any) => {
      request.getCurrentUser = async () => ({ sub: mockUser.id })
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/me')
      .expect(200)

    expect(response.body).toEqual(mockUser)
  })

  it('should return 401 if user not found', async () => {
    (db.query.users.findFirst as any).mockResolvedValue(null)

    app = buildApp(async (request: any, _reply: any) => {
      request.getCurrentUser = async () => ({ sub: 'invalid-user-id' })
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/me')
      .expect(401)

    expect(response.body.message).toMatch(/user not found/i)
  })

  it('should return 500 if DB query throws', async () => {
    (db.query.users.findFirst as any).mockImplementation(() => {
      throw new Error('DB error')
    })

    app = buildApp(async (request: any, _reply: any) => {
      request.getCurrentUser = async () => ({ sub: mockUser.id })
    })
    await app.ready()

    const response = await supertest(app.server)
      .get('/me')
      .expect(500)

    expect(response.body.message).toBe('An error occurred while fetching user profile.')
  })
})
