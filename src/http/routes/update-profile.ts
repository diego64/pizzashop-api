import { t, Elysia, Context } from 'elysia'
import { authentication } from '../authentication'
import { db } from '@/db/connection'
import { restaurants } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const updateProfile = new Elysia()
  .use(authentication)
  .put(
    '/profile',
    async (ctx: Context<{ body: { name: string; description?: string } }> & { getManagedRestaurantId: () => Promise<number>, set: { status: number } }) => {
      const { getManagedRestaurantId, set, body } = ctx

      const restaurantId = await getManagedRestaurantId()
      const { name, description } = body

      await db
        .update(restaurants)
        .set({
          name,
          description,
        })
        .where(eq(restaurants.id, restaurantId.toString()))

      set.status = 204
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
      }),
    },
  )
