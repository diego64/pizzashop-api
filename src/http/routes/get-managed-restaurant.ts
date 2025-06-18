import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@/db/connection'

interface RequestWithManagedRestaurant extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function getManagedRestaurant(app: FastifyInstance) {
  app.get(
    '/managed-restaurant',
    {
      preHandler: [app.authenticate],
    },
    async (request: RequestWithManagedRestaurant, reply: FastifyReply) => {
      try {
        const restaurantId = await request.getManagedRestaurantId()

        const restaurant = await db.query.restaurants.findFirst({
          where(fields, { eq }) {
            return eq(fields.id, restaurantId)
          },
        })

        if (!restaurant) {
          return reply.status(404).send({ error: 'Restaurant not found.' })
        }

        return reply.send(restaurant)
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Internal Server Error' })
      }
    }
  )
}
