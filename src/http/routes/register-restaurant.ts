import { restaurants, users } from '@/db/schema'
import { db } from '@/db/connection'
import { t, Elysia } from 'elysia'

export function registerRestaurant(app: Elysia) {
  app.post(
    '/restaurants',
    async ({ body, set }) => {
      const { restaurantName, managerName, email, phone } = body

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

      set.status = 204
    },
    {
      body: t.Object({
        restaurantName: t.String(),
        managerName: t.String(),
        phone: t.String(),
        email: t.String({ format: 'email' }),
      }),
    },
  )
}
