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
    signUser: (payload: { sub: string; restaurantId?: string }) => Promise<void>
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
  const mockSignUser = vi.fn(async function (this: import('fastify').FastifyRequest, payload: any) {
    this.userPayload = payload
  })

  beforeEach(async () => {
    app = fastify()

    app.setErrorHandler((error, request, reply) => {
      if (error instanceof UnauthorizedError) {
        reply.status(401).send({ message: error.message })
      } else {
        reply.status(500).send({ message: error.message })
      }
    })

    app.decorateRequest('signUser', mockSignUser)

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
      id: 'auth-id-1'
    })

    vi.mocked(db.query.restaurants.findFirst).mockResolvedValue({
      id: 'resto-1',
      managerId: 'user-123',
      description: null,
      name: '',
      createdAt: null,
      updatedAt: null
    })

    const mockWhere = vi.fn()
    vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any)

    const response = await app.inject({
      method: 'GET',
      url: `/auth-links/authenticate?code=valid-code&redirect=https://redirect.url`,
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://redirect.url')

    // Confirma que signUser foi chamado corretamente
    expect(mockSignUser).toHaveBeenCalledWith({
      sub: 'user-123',
      restaurantId: 'resto-1',
    })

    // Confirma que o link foi deletado
    expect(db.delete).toHaveBeenCalledWith(authLinks)
    expect(mockWhere).toHaveBeenCalled()
  })

  it('should return 500 if unexpected error occurs', async () => {
    // Simular erro interno inesperado
    vi.mocked(db.query.authLinks.findFirst).mockImplementation(() => {
      throw new Error('Unexpected failure')
    })

    const response = await app.inject({
      method: 'GET',
      url: `/auth-links/authenticate?code=any-code&redirect=https://redirect.url`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      message: 'Unexpected failure',
    })
  })
})
