import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { restaurants, users } from '@/db/schema'

const registerRestaurantBodySchema = z.object({
  restaurantName: z.string(),
  managerName: z.string(),
  phone: z.string(),
  email: z.string().email(),
})

type RegisterRestaurantBody = z.infer<typeof registerRestaurantBodySchema>

export async function registerRestaurant(app: FastifyInstance) {
  app.post('/restaurants', async (request: FastifyRequest, reply: FastifyReply) => {
    const { restaurantName, managerName, phone, email } = registerRestaurantBodySchema.parse(request.body)

    const [manager] = await db
      .insert(users)
      .values({
        name: managerName,
        email,
        phone,
        role: 'manager',
      })
      .returning()

    await db.insert(restaurants).values({
      name: restaurantName,
      managerId: manager.id,
    })

    reply.status(204).send()
  })
}
