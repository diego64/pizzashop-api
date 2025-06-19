import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { db } from '@/db/connection'
import { JwtPayload } from '@/http/authentication'

const querySchema = z.object({
  pageIndex: z.coerce.number().min(0).default(0),
})

type Query = z.infer<typeof querySchema>

interface RequestWithCurrentUser extends FastifyRequest {
  getCurrentUser: () => Promise<JwtPayload>
}

export async function getEvaluations(app: FastifyInstance) {
  app.get(
    '/evaluations',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: zodToJsonSchema(querySchema, 'querySchema'),
      },
    },
    async (request: RequestWithCurrentUser, reply: FastifyReply) => {
      const { restaurantId } = await request.getCurrentUser()

      if (!restaurantId) {
        return reply.status(401).send({ error: 'User is not a restaurant manager.' })
      }

      const { pageIndex } = querySchema.parse(request.query)

      const evaluations = await db.query.evaluations.findMany({
        offset: pageIndex * 10,
        limit: 10,
        orderBy: (evaluations, { desc }) => desc(evaluations.createdAt),
      })

      return reply.send(evaluations)
    },
  )
}
