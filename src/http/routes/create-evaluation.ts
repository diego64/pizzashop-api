import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { evaluations } from '@/db/schema'

const bodySchema = z.object({
  restaurantId: z.string(),
  rate: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

const bodyJsonSchema = {
  type: 'object',
  required: ['restaurantId', 'rate'],
  properties: {
    restaurantId: { type: 'string' },
    rate: { type: 'integer', minimum: 1, maximum: 5 },
    comment: { type: 'string' },
  },
  additionalProperties: false,
}

export async function createEvaluation(app: FastifyInstance) {
  app.post(
    '/evaluations',
    {
      preHandler: [app.authenticate],
      schema: {
        body: bodyJsonSchema,
        response: {
          201: {
            type: 'null',
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { restaurantId, rate, comment } = request.body as z.infer<typeof bodySchema>

      const { sub: userId } = await request.getCurrentUser()

      await db.insert(evaluations).values({
        restaurantId,
        customerId: userId,
        rate,
        comment,
      })

      return reply.status(201).send()
    }
  )
}
