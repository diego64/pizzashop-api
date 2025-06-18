import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import type { JwtPayload } from '../authentication'
import { UnauthorizedError } from './errors/unauthorized-error'
import { NotAManagerError } from './errors/not-a-manager-error'

const paramsSchema = z.object({
  id: z.string(),
})

interface RequestWithCurrentUser extends FastifyRequest {
  getCurrentUser: () => Promise<JwtPayload>
}

export async function getOrderDetails(app: FastifyInstance) {
  app.get(
    '/orders/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request: RequestWithCurrentUser, reply: FastifyReply) => {
      const parseResult = paramsSchema.safeParse(request.params)
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid params' })
      }
      const { id: orderId } = parseResult.data

      const { restaurantId } = await request.getCurrentUser()

      if (!restaurantId) {
        // Aqui lança seu erro customizado NotAManagerError
        throw new NotAManagerError()
      }

      const order = await db.query.orders.findFirst({
        columns: {
          id: true,
          createdAt: true,
          status: true,
          totalInCents: true,
        },
        with: {
          customer: {
            columns: {
              name: true,
              phone: true,
              email: true,
            },
          },
          orderItems: {
            columns: {
              id: true,
              priceInCents: true,
              quantity: true,
            },
            with: {
              product: {
                columns: {
                  name: true,
                },
              },
            },
          },
        },
        where(fields, { eq, and }) {
          return and(eq(fields.id, orderId), eq(fields.restaurantId, restaurantId))
        },
      })

      if (!order) {
        // Lança seu erro customizado UnauthorizedError
        throw new UnauthorizedError()
      }

      return reply.send(order)
    },
  )
}
