import { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'

const paramsSchema = z.object({
  id: z.string(),
})

export async function cancelOrder(app: FastifyInstance) {
  app.patch(
    '/orders/:id/cancel',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id: orderId } = request.params as z.infer<typeof paramsSchema>

      const { restaurantId } = await request.getCurrentUser()

      if (!restaurantId) {
        throw new UnauthorizedError('User is not a restaurant manager.')
      }

      const order = await db.query.orders.findFirst({
        where(fields, { eq, and }) {
          return and(
            eq(fields.id, orderId),
            eq(fields.restaurantId, restaurantId),
          )
        },
      })

      if (!order) {
        throw new UnauthorizedError('Order not found under the user managed restaurant.')
      }

      if (!['pending', 'processing'].includes(order.status)) {
        return reply.status(400).send({
          code: 'STATUS_NOT_VALID',
          message: 'O pedido não pode ser cancelado depois de ser enviado.',
        })
      }

      await db
        .update(orders)
        .set({ status: 'canceled' })
        .where(eq(orders.id, orderId))

      return reply.status(204).send()
    },
  )
}
