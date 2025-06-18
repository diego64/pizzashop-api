import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/db/connection'
import { orderItems, orders, products } from '@/db/schema'
import { UnauthorizedError } from './errors/unauthorized-error'

interface RequestWithUser extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function getPopularProducts(app: FastifyInstance) {
  app.get('/metrics/popular-products', {
    preHandler: [app.authenticate],
    onSend: async (request, reply, payload) => {
      reply.header('X-Powered-By', 'Fastify')
      reply.header('Cache-Control', 'no-cache')
      return payload
    },
  }, async (request: RequestWithUser, reply: FastifyReply) => {
    const restaurantId = await request.getManagedRestaurantId()

    if (!restaurantId) {
      throw new UnauthorizedError('User is not authorized to access this resource.')
    }

    try {
      const popularProducts = await db
        .select({
          product: products.name,
          amount: count(orderItems.id),
        })
        .from(orderItems)
        .leftJoin(orders, eq(orders.id, orderItems.orderId))
        .leftJoin(products, eq(products.id, orderItems.productId))
        .where(and(eq(orders.restaurantId, restaurantId)))
        .groupBy(products.name)
        .limit(5)

      return popularProducts
    } catch (err) {
      console.error(err)
      reply.status(500)
      return {
        message: 'An error occurred while fetching popular products.',
      }
    }
  })
}
