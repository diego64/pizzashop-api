import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import dayjs from 'dayjs'
import { db } from '@/db/connection'
import { authLinks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'

export async function authenticateFromLink(app: FastifyInstance) {
  app.get(
    '/auth-links/authenticate',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            redirect: { type: 'string' },
          },
          required: ['code', 'redirect'],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, redirect } = request.query as { code: string; redirect: string }

      const authLinkFromCode = await db.query.authLinks.findFirst({
        where(fields, { eq }) {
          return eq(fields.code, code)
        },
      })

      if (!authLinkFromCode) {
        throw new UnauthorizedError()
      }

      if (dayjs().diff(authLinkFromCode.createdAt, 'days') > 7) {
        throw new UnauthorizedError()
      }

      const managedRestaurant = await db.query.restaurants.findFirst({
        where(fields, { eq }) {
          return eq(fields.managerId, authLinkFromCode.userId)
        },
      })

      await request.signUser({
        sub: authLinkFromCode.userId,
        restaurantId: managedRestaurant?.id,
      })

      await db.delete(authLinks).where(eq(authLinks.code, code))

      return reply.redirect(redirect)
    }
  )
}
