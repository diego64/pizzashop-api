import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'

interface RequestWithManagedRestaurantId extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function getDayOrdersAmount(app: FastifyInstance) {
  app.get(
    '/metrics/day-orders-amount',
    {
      preHandler: [app.authenticate],
    },
    async (request: RequestWithManagedRestaurantId, reply: FastifyReply) => {
      const restaurantId = await request.getManagedRestaurantId()

      const today = dayjs()
      const yesterday = today.subtract(1, 'day')
      const startOfYesterday = yesterday.startOf('day')

      const yesterdayWithMonthAndYear = yesterday.format('YYYY-MM-DD')
      const todayWithMonthAndYear = today.format('YYYY-MM-DD')

      const ordersPerDay = await db
        .select({
          dayWithMonthAndYear: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`,
          amount: count(orders.id),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, startOfYesterday.toDate()),
          ),
        )
        .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`)
        .having(({ amount }) => gte(amount, 1))

      const todayOrdersAmount = ordersPerDay.find(
        (orderInDay) => orderInDay.dayWithMonthAndYear === todayWithMonthAndYear,
      )

      const yesterdayOrdersAmount = ordersPerDay.find(
        (orderInDay) => orderInDay.dayWithMonthAndYear === yesterdayWithMonthAndYear,
      )

      const diffFromYesterday =
        yesterdayOrdersAmount && todayOrdersAmount
          ? (todayOrdersAmount.amount * 100) / yesterdayOrdersAmount.amount
          : null

      return reply.send({
        amount: todayOrdersAmount?.amount ?? 0,
        diffFromYesterday: diffFromYesterday
          ? Number((diffFromYesterday - 100).toFixed(2))
          : 0,
      })
    },
  )
}
