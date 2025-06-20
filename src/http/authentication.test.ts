import { describe, expect, it, beforeEach } from 'vitest'
import fastify, { FastifyInstance, FastifyError } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import authenticationPlugin from './authentication'
import { UnauthorizedError } from './routes/errors/unauthorized-error'
import { NotAManagerError } from './routes/errors/not-a-manager-error'

describe('Authentication plugin', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = fastify()

    await app.register(cookie)
    await app.register(jwt, { secret: 'super-secret' })
    await app.register(authenticationPlugin)

    app.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error instanceof UnauthorizedError ? 401 :
        error instanceof NotAManagerError ? 500 : 500

      reply.status(statusCode).send({
        error: error.name,
        message: error.message,
      })
    })

    app.get('/sign', async (_req, reply) => {
      await app.signUser(reply, { sub: 'user-123', restaurantId: 'rest-456' })
      reply.send()
    })

    app.get('/me', {
      preHandler: [app.authenticate],
      handler: async (req, reply) => {
        const user = await req.getCurrentUser()
        return reply.send(user)
      },
    })

    app.get('/restaurant', {
      preHandler: [app.authenticate],
      handler: async (req, reply) => {
        const restaurantId = await req.getManagedRestaurantId()
        return reply.send({ restaurantId })
      },
    })

    app.get('/protected', {
      preHandler: [app.authenticate],
      handler: async (_req, reply) => {
        return reply.send({ ok: true })
      },
    })

    await app.ready()
  })

  it('should sign a user and set a cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/sign',
    })

    expect(response.statusCode).toBe(200)
    expect(response.cookies.some(c => c.name === 'auth')).toBe(true)
  })

  it('should return current user using /me', async () => {
    const token = await app.jwt.sign({ sub: 'user-123', restaurantId: 'rest-456' })

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ sub: 'user-123', restaurantId: 'rest-456' })
  })

  it('should return managed restaurant id using /restaurant', async () => {
    const token = await app.jwt.sign({ sub: 'user-123', restaurantId: 'rest-456' })

    const response = await app.inject({
      method: 'GET',
      url: '/restaurant',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ restaurantId: 'rest-456' })
  })

  it('should return 401 on /protected without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'UnauthorizedError',
      message: 'Unauthorized',
    })
  })

  it('should throw NotAManagerError when no restaurantId', async () => {
    const token = await app.jwt.sign({ sub: 'user-123' })

    const response = await app.inject({
      method: 'GET',
      url: '/restaurant',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'NotAManagerError',
      message: 'User is not a restaurant manager.',
    })
  })
})
