import { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { orderItems } from '@/db/schema/order-items'

export async function createOrder(app: FastifyInstance) {
  app.post(
    '/restaurants/:restaurantId/orders',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          restaurantId: z.string(),
        }),
        body: z.object({
          items: z.array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            })
          ),
        }),
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string }
      const { items } = request.body as {
        items: { productId: string; quantity: number }[]
      }

      const { sub: customerId } = await request.getCurrentUser()

      const productsIds = items.map((item) => item.productId)

      const availableProducts = await db.query.products.findMany({
        where(fields, { eq, and, inArray }) {
          return and(
            eq(fields.restaurantId, restaurantId),
            inArray(fields.id, productsIds)
          )
        },
      })

      const orderProducts = items.map((item) => {
        const product = availableProducts.find(p => p.id === item.productId)

        if (!product) {
          throw new Error('Not all products are available in this restaurant.')
        }

        return {
          productId: item.productId,
          unitPriceInCents: product.priceInCents,
          quantity: item.quantity,
          subtotalInCents: product.priceInCents * item.quantity,
        }
      })

      const totalInCents = orderProducts.reduce(
        (acc, item) => acc + item.subtotalInCents,
        0
      )

      await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            customerId,
            restaurantId,
            totalInCents,
          })
          .returning({ id: orders.id })

        await tx.insert(orderItems).values(
          orderProducts.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            priceInCents: item.unitPriceInCents,
            quantity: item.quantity,
          }))
        )
      })

      return reply.status(201).send()
    }
  )
}
