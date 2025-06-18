import { t, Elysia, Context } from 'elysia'
import { authentication } from '../authentication'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'

type ApproveOrderSchema = {
  params: {
    id: string
  }
}

type ApproveOrderContext = Context<ApproveOrderSchema> & {
  store: {
    getManagedRestaurantId: () => Promise<string>
  }
}

export const approveOrder = new Elysia()
  .use(authentication)
  .patch(
    '/orders/:id/approve',
    async ({ params, set, store }: ApproveOrderContext) => {
      const { id: orderId } = params
      const restaurantId = await store.getManagedRestaurantId()

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

      if (order.status !== 'pending') {
        set.status = 400
        return { message: 'Order was already approved before.' }
      }

      await db
        .update(orders)
        .set({ status: 'processing' })
        .where(eq(orders.id, orderId))

      set.status = 204
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )