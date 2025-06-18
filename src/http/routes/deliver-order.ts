import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'

export async function deliverOrder(app: FastifyInstance) {
  app.patch(
    '/orders/:id/deliver',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id: orderId } = request.params as { id: string }

      const restaurantId = await request.getManagedRestaurantId()

      const order = await db.query.orders.findFirst({
        where(fields, { eq, and }) {
          return and(
            eq(fields.id, orderId),
            eq(fields.restaurantId, restaurantId),
          )
        },
      })

      if (!order) {
        throw new UnauthorizedError()
      }

      if (order.status !== 'delivering') {
        return reply.status(400).send({
          message: 'O pedido já foi entregue.',
        })
      }

      await db
        .update(orders)
        .set({ status: 'delivered' })
        .where(eq(orders.id, orderId))

      return reply.status(204).send()
    }
  )
}
