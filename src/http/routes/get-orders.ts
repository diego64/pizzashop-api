import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { orders, users } from '@/db/schema'
import { db } from '@/db/connection'
import { eq, and, ilike, desc, count, sql } from 'drizzle-orm'
import { z } from 'zod'
import { UnauthorizedError } from './errors/unauthorized-error'
import type { JwtPayload } from '@/http/authentication'

const querySchema = z.object({
  customerName: z.string().optional(),
  orderId: z.string().optional(),
  status: z.enum(['pending', 'processing', 'delivering', 'delivered', 'canceled']).optional(),
  pageIndex: z.number().min(0),
})

type Query = z.infer<typeof querySchema>

interface RequestWithUser extends FastifyRequest {
  getCurrentUser: () => Promise<JwtPayload>
}

export async function getOrders(app: FastifyInstance) {
  app.get('/orders', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          orderId: { type: 'string' },
          status: { 
            type: 'string', 
            enum: ['pending', 'processing', 'delivering', 'delivered', 'canceled'] 
          },
          pageIndex: { type: 'number', minimum: 0 },
        },
        required: ['pageIndex'],
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  orderId: { type: 'string' },
                  createdAt: { type: 'string' },
                  status: { type: 'string' },
                  customerName: { type: 'string' },
                  total: { type: 'number' },
                },
                required: ['orderId', 'createdAt', 'status', 'customerName', 'total'],
              },
            },
            meta: {
              type: 'object',
              properties: {
                pageIndex: { type: 'number' },
                perPage: { type: 'number' },
                totalCount: { type: 'number' },
              },
              required: ['pageIndex', 'perPage', 'totalCount'],
            },
          },
          required: ['orders', 'meta'],
        },
      },
    },
  }, async (request: RequestWithUser, reply: FastifyReply) => {
    const parsedQuery = querySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' })
    }

    const { pageIndex, orderId, customerName, status } = parsedQuery.data

    const { restaurantId } = await request.getCurrentUser()

    if (!restaurantId) {
      reply.status(401)
      throw new UnauthorizedError('User is not a restaurant manager.')
    }

    const baseQuery = db
      .select({
        orderId: orders.id,
        createdAt: orders.createdAt,
        status: orders.status,
        customerName: users.name,
        total: orders.totalInCents,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.customerId))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          orderId ? ilike(orders.id, `%${orderId}%`) : undefined,
          status ? eq(orders.status, status) : undefined,
          customerName ? ilike(users.name, `%${customerName}%`) : undefined,
        ),
      )

    const [ordersCount] = await db
      .select({ count: count() })
      .from(baseQuery.as('baseQuery'))

    const allOrders = await baseQuery
      .offset(pageIndex * 10)
      .limit(10)
      .orderBy((fields) => [
        sql`CASE ${fields.status} 
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          WHEN 'delivering' THEN 3
          WHEN 'delivered' THEN 4
          WHEN 'canceled' THEN 99
        END`,
        desc(fields.createdAt),
      ])

    return {
      orders: allOrders,
      meta: {
        pageIndex,
        perPage: 10,
        totalCount: ordersCount.count,
      },
    }
  })
}
