import { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { UnauthorizedError } from './errors/unauthorized-error'

const paramsSchema = z.object({
  id: z.string(),
})

export async function dispatchOrder(app: FastifyInstance) {
  app.patch(
    '/orders/:id/dispatch',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id: orderId } = request.params as z.infer<typeof paramsSchema>

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

      if (order.status !== 'processing') {
        return reply.status(400).send({
          message: 'O pedido já foi enviado ao cliente.',
        })
      }

      await db
        .update(orders)
        .set({ status: 'delivering' })
        .where(eq(orders.id, orderId))

      return reply.status(204).send()
    },
  )
}
