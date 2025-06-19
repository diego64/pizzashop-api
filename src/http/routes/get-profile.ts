import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@/db/connection'
import { UnauthorizedError } from './errors/unauthorized-error'

type UserPayload = {
  sub: string
  restaurantId?: string
}

interface RequestWithUser extends FastifyRequest {
  getCurrentUser: () => Promise<UserPayload>
}

export async function getProfile(app: FastifyInstance) {
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: RequestWithUser, reply: FastifyReply) => {
    const { sub: userId } = await request.getCurrentUser()

    const user = await db.query.users.findFirst({
      where(fields, { eq }) {
        return eq(fields.id, userId)
      },
    })

    if (!user) {
      throw new UnauthorizedError('User not found.')
    }

    return user
  })
}
