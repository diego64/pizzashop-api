import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@/db/connection'
import { JwtPayload } from '@/http/authentication'

interface RequestWithCurrentUser extends FastifyRequest {
  getCurrentUser: () => Promise<JwtPayload>
}

export async function getEvaluations(app: FastifyInstance) {
  app.get(
    '/evaluations',
    {
      preHandler: [app.authenticate],
    },
    async (request: RequestWithCurrentUser, reply: FastifyReply) => {
      const { restaurantId } = await request.getCurrentUser()

      if (!restaurantId) {
        return reply.status(401).send({ error: 'User is not a restaurant manager.' })
      }

      const rawPageIndex = (request.query as any).pageIndex
      const pageIndex = Number(rawPageIndex)
      const safePageIndex = Number.isInteger(pageIndex) && pageIndex >= 0 ? pageIndex : 0

      const evaluations = await db.query.evaluations.findMany({
        offset: safePageIndex * 10,
        limit: 10,
        orderBy: (evaluations, { desc }) => desc(evaluations.createdAt),
        where: (evaluations, { eq }) =>
          eq(evaluations.restaurantId, restaurantId),
      })

      return reply.send(evaluations)
    },
  )
}
