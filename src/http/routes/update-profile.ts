import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { restaurants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'
import { zodToJsonSchema } from 'zod-to-json-schema'

const updateProfileBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
})

const updateProfileBodyJsonSchema = zodToJsonSchema(updateProfileBodySchema, 'UpdateProfileBodySchema')

interface RequestWithManager extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function updateProfile(app: FastifyInstance) {
  app.put(
    '/profile',
    {
      preHandler: [app.authenticate],
      schema: {
        body: updateProfileBodyJsonSchema,
      },
    },
    async (request: RequestWithManager, reply: FastifyReply) => {
      const { name, description } = request.body as z.infer<typeof updateProfileBodySchema>

      const restaurantId = await request.getManagedRestaurantId()

      if (!restaurantId) {
        throw new UnauthorizedError('User is not a manager.')
      }

      await db
        .update(restaurants)
        .set({ name, description })
        .where(eq(restaurants.id, restaurantId))

      reply.status(204).send()
    }
  )
}
