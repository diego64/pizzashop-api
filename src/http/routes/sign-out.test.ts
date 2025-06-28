import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { signOut } from './sign-out'
import { UnauthorizedError } from './errors/unauthorized-error'

describe('signOut route', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    app.setErrorHandler((error, _, reply) => {
      if (error instanceof UnauthorizedError) {
        return reply.status(401).send({ message: error.message })
      }

      reply.status(500).send({ message: 'Internal server error' })
    })

    app.decorate('authenticate', async (request, reply) => {
    })

    app.addHook('onRequest', (request, _, done) => {
      if (request.headers['x-test-signout'] === 'true') {
        (request as any).signOut = vi.fn()
      }
      done()
    })

    await signOut(app)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('should return 204 on successful sign out', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sign-out',
      headers: {
        'x-test-signout': 'true', // ativa o hook que adiciona o signOut
      },
    })

    expect(response.statusCode).toBe(204)
  })

  it('should return 401 if signOut method is not available', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sign-out',
    })

    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body)
    expect(body.message).toBe('Sign-out method not available')
  })
})
