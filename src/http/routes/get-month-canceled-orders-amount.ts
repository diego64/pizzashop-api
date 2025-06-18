import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'

interface RequestWithManagedRestaurant extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function getMonthCanceledOrdersAmount(app: FastifyInstance) {
  app.get(
    '/metrics/month-canceled-orders-amount',
    {
      preHandler: [app.authenticate],
    },
    async (request: RequestWithManagedRestaurant, reply: FastifyReply) => {
      try {
        const restaurantId = await request.getManagedRestaurantId()

        const today = dayjs()
        const lastMonth = today.subtract(1, 'month')
        const startOfLastMonth = lastMonth.startOf('month')

        const lastMonthWithYear = lastMonth.format('YYYY-MM')
        const currentMonthWithYear = today.format('YYYY-MM')

        const ordersPerMonth = await db
          .select({
            monthWithYear: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
            amount: count(orders.id),
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, restaurantId),
              eq(orders.status, 'canceled'),
              gte(orders.createdAt, startOfLastMonth.toDate()),
            ),
          )
          .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
          .having(({ amount }) => gte(amount, 1))

        const currentMonthOrdersAmount = ordersPerMonth.find(
          (ordersInMonth) => ordersInMonth.monthWithYear === currentMonthWithYear,
        )

        const lastMonthOrdersAmount = ordersPerMonth.find(
          (ordersInMonth) => ordersInMonth.monthWithYear === lastMonthWithYear,
        )

        const diffFromLastMonth =
          lastMonthOrdersAmount && currentMonthOrdersAmount
            ? (currentMonthOrdersAmount.amount * 100) / lastMonthOrdersAmount.amount
            : null

        return reply.send({
          amount: currentMonthOrdersAmount?.amount ?? 0,
          diffFromLastMonth: diffFromLastMonth
            ? Number((diffFromLastMonth - 100).toFixed(2))
            : 0,
        })
      } catch (error) {
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        })
      }
    }
  )
}
