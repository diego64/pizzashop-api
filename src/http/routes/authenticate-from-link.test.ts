import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import dayjs from 'dayjs'
import { authenticateFromLink } from './authenticate-from-link'
import { db } from '@/db/connection'
import { UnauthorizedError } from './errors/unauthorized-error'
import { authLinks } from '@/db/schema'

declare module 'fastify' {
  interface FastifyRequest {
    userPayload?: any
  }
}

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      authLinks: {
        findFirst: vi.fn(),
      },
      restaurants: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}))

describe('authenticateFromLink route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.setErrorHandler((error, request, reply) => {
      if (error instanceof UnauthorizedError) {
        reply.status(401).send({ message: error.message })
      } else {
        reply.status(500).send({ message: error.message })
      }
    })

    // Mock do método signUser no request
    app.decorateRequest('signUser', async function (payload: any) {
      this.userPayload = payload
    })

    await authenticateFromLink(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()
  })

  it('should return 401 UnauthorizedError if code does not exist', async () => {
    vi.mocked(db.query.authLinks.findFirst).mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'GET',
      url: `/auth-links/authenticate?code=invalid-code&redirect=https://redirect.url`,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ message: 'Unauthorized' })
  })

  it('should return 401 UnauthorizedError if auth link is expired (>7 days)', async () => {
    const createdAtOld = dayjs().subtract(8, 'days').toDate()

    vi.mocked(db.query.authLinks.findFirst).mockResolvedValue({
      code: 'valid-code',
      userId: 'user-123',
      createdAt: createdAtOld,
      id: ''
    })

    const response = await app.inject({
      method: 'GET',
      url: `/auth-links/authenticate?code=valid-code&redirect=https://redirect.url`,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ message: 'Unauthorized' })
  })

  it('should authenticate user, delete link and redirect if valid', async () => {
    const now = new Date()

    vi.mocked(db.query.authLinks.findFirst).mockResolvedValue({
      code: 'valid-code',
      userId: 'user-123',
      createdAt: now,
      id: ''
    })

    vi.mocked(db.query.restaurants.findFirst).mockResolvedValue({
      id: 'resto-1',
      managerId: 'user-123',
      description: null,
      name: '',
      createdAt: null,
      updatedAt: null
    })

    // Mock para delete().where()
    const mockWhere = vi.fn()
    vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any)

    const response = await app.inject({
      method: 'GET',
      url: `/auth-links/authenticate?code=valid-code&redirect=https://redirect.url`,
    })

    // A rota deve redirecionar para redirect
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://redirect.url')

    // Verifica se o método delete foi chamado corretamente
    expect(db.delete).toHaveBeenCalledWith(authLinks)
    expect(mockWhere).toHaveBeenCalled()
  })
})
