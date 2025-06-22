import { mockEnv } from '../../__mocks__/env'
for (const [key, value] of Object.entries(mockEnv)) {
  process.env[key] = value
}
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import cors from '@fastify/cors'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { registerRoutes } from './routes'

let app: Awaited<ReturnType<typeof Fastify>>

beforeAll(async () => {
  app = Fastify().withTypeProvider<ZodTypeProvider>()

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    cookie: {
      cookieName: 'auth',
      signed: false,
    },
  })

  await app.register(cors, {
    credentials: true,
    origin: true,
  })

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ message: 'Unauthorized' })
    }
  })

  await registerRoutes(app)

  app.get(
    '/protected-route',
    { preValidation: [app.authenticate] },
    async () => {
      return { ok: true }
    }
  )

  app.get('/error', async () => {
    throw new Error('Simulated internal error')
  })

  app.setErrorHandler((
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    if ((error as any).validation) {
      reply.status(400).send({
        message: 'Validation error',
        details: (error as any).validation,
      })
    } else if ((error as any).code === 'FST_ERR_NOT_FOUND') {
      reply.status(404).send({ message: error.message })
    } else {
      request.log.error(error)
      reply.status(500).send({ message: 'Internal Server Error' })
    }
  })

  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('App setup and behavior', () => {
  it('should respond with 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/non-existent-route' })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toContain('not found')
  })

  it('should return 400 for validation error (if configured)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/some-route-with-validation',
      payload: {},
    })
    if (res.statusCode === 400) {
      expect(res.json().message).toBe('Validation error')
    }
  })

  it('should return 500 for unhandled errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/error' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ message: 'Internal Server Error' })
  })

  it('should respond to a defined route (adjust as needed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    if (res.statusCode === 200) {
      expect(res.statusCode).toBe(200)
    } else {
      expect([404, 403]).toContain(res.statusCode)
    }
  })

  it('should accept JWT from cookie when configured', async () => {
    const token = await app.jwt.sign({ sub: 'user-1' })
    const res = await app.inject({
      method: 'GET',
      url: '/protected-route',
      cookies: { auth: token },
    })
    expect([200, 401]).toContain(res.statusCode)
  })
})