import fp from 'fastify-plugin'
import fastifyJwt, { JWT } from '@fastify/jwt'
import type { FastifyCookieOptions } from '@fastify/cookie'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { env } from '@/env'
import { UnauthorizedError } from './routes/errors/unauthorized-error'
import { NotAManagerError } from './routes/errors/not-a-manager-error'

export interface JwtPayload {
  sub: string
  restaurantId?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    jwt: JWT
    getCurrentUser: () => Promise<JwtPayload>
    getManagedRestaurantId: () => Promise<string>
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    signUser: (reply: FastifyReply, payload: JwtPayload) => Promise<void>
  }
}

export default fp(async (app: FastifyInstance) => {
  // ✅ Certifique-se de ter o plugin JWT já registrado antes deste plugin

  if (!app.hasRequestDecorator('getCurrentUser')) {
    app.decorateRequest('getCurrentUser', async function () {
      try {
        const payload = await this.jwtVerify<JwtPayload>()

        if (!payload.sub) {
          throw new UnauthorizedError()
        }

        return payload
      } catch {
        throw new UnauthorizedError()
      }
    })
  }

  if (!app.hasRequestDecorator('getManagedRestaurantId')) {
    app.decorateRequest('getManagedRestaurantId', async function () {
      const user = await this.getCurrentUser()

      if (!user.restaurantId) {
        throw new NotAManagerError()
      }

      return user.restaurantId
    })
  }

  if (!app.hasDecorator('authenticate')) {
    app.decorate('authenticate', async (request: FastifyRequest) => {
      try {
        await request.getCurrentUser()
      } catch {
        // ✅ Lança erro para que o setErrorHandler capture
        throw new UnauthorizedError()
      }
    })
  }

  if (!app.hasDecorator('signUser')) {
    app.decorate('signUser', async (reply: FastifyReply, payload: JwtPayload) => {
      const token = await app.jwt.sign(payload)

      reply.setCookie('auth', token, {
        httpOnly: true,
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      })
    })
  }
})
