import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { restaurants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'

const updateProfileBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
})

interface RequestWithManager extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function updateProfile(app: FastifyInstance) {
  app.put('/profile', {
    preHandler: [app.authenticate],
    schema: {
      body: updateProfileBodySchema,
    },
  }, async (request: RequestWithManager, reply: FastifyReply) => {
    const { name, description } = updateProfileBodySchema.parse(request.body)

    const restaurantId = await request.getManagedRestaurantId()

    if (!restaurantId) {
      throw new UnauthorizedError('User is not a manager.')
    }

    await db
      .update(restaurants)
      .set({ name, description })
      .where(eq(restaurants.id, restaurantId))

    reply.status(204).send()
  })
}
