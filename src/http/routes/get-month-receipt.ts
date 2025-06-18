import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { and, eq, gte, sql, sum } from 'drizzle-orm'
import dayjs from 'dayjs'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'

interface RequestWithManagedRestaurant extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string>
}

export async function getMonthReceipt(app: FastifyInstance) {
  app.get(
    '/metrics/month-receipt',
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

        const monthsReceipts = await db
          .select({
            monthWithYear: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
            receipt: sum(orders.totalInCents).mapWith(Number),
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, restaurantId),
              gte(orders.createdAt, startOfLastMonth.toDate()),
            ),
          )
          .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
          .having(({ receipt }) => gte(receipt, 1))

        const currentMonthReceipt = monthsReceipts.find(
          (monthReceipt) => monthReceipt.monthWithYear === currentMonthWithYear,
        )

        const lastMonthReceipt = monthsReceipts.find(
          (monthReceipt) => monthReceipt.monthWithYear === lastMonthWithYear,
        )

        const diffFromLastMonth =
          lastMonthReceipt && currentMonthReceipt
            ? (currentMonthReceipt.receipt * 100) / lastMonthReceipt.receipt
            : null

        return reply.send({
          receipt: currentMonthReceipt?.receipt ?? 0,
          diffFromLastMonth: diffFromLastMonth
            ? Number((diffFromLastMonth - 100).toFixed(2))
            : 0,
        })
      } catch (error) {
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        })
      }
    },
  )
}
