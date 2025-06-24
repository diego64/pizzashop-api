import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import dayjs from 'dayjs'
import { db } from '@/db/connection'
import { orders } from '@/db/schema'
import { and, eq, gte, lte, sql, sum } from 'drizzle-orm'

const querySchema = z.object({
  from: z.string().optional().refine((val) => !val || dayjs(val).isValid(), {
    message: 'Invalid date format for from',
  }),
  to: z.string().optional().refine((val) => !val || dayjs(val).isValid(), {
    message: 'Invalid date format for to',
  }),
})

type Query = z.infer<typeof querySchema>

export async function getDailyReceiptInPeriod(app: FastifyInstance) {
  app.get(
    '/metrics/daily-receipt-in-period',
    {
      preHandler: [app.authenticate],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({ message: 'Invalid query parameters' })
      }
      const { from, to } = parseResult.data

      const restaurantId = await request.getManagedRestaurantId()

      const startDate = from ? dayjs(from) : dayjs().subtract(7, 'days')
      const endDate = to
        ? dayjs(to)
        : from
        ? startDate.add(7, 'days')
        : dayjs()

      if (endDate.diff(startDate, 'days') > 7) {
        return reply.status(400).send({
          code: 'INVALID_PERIOD',
          message: 'O intervalo das datas não pode ser superior a 7 dias.',
        })
      }

      const receiptPerDay = await db
        .select({
          date: sql<string>`TO_CHAR(${orders.createdAt}, 'DD/MM')`,
          receipt: sum(orders.totalInCents).mapWith(Number),
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(
              orders.createdAt,
              startDate
                .startOf('day')
                .add(startDate.utcOffset(), 'minutes')
                .toDate(),
            ),
            lte(
              orders.createdAt,
              endDate
                .endOf('day')
                .add(endDate.utcOffset(), 'minutes')
                .toDate(),
            ),
          ),
        )
        .groupBy(sql`TO_CHAR(${orders.createdAt}, 'DD/MM')`)
        .having(({ receipt }) => gte(receipt, 1))

      const orderedReceiptPerDay = receiptPerDay.sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number)
        const [dayB, monthB] = b.date.split('/').map(Number)

        if (monthA === monthB) {
          return dayA - dayB
        }

        const dateA = new Date(2024, monthA - 1)
        const dateB = new Date(2024, monthB - 1)
        return dateA.getTime() - dateB.getTime()
      })

      return reply.send(orderedReceiptPerDay)
    },
  )
}
