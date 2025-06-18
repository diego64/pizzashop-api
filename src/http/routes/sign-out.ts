import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from './errors/unauthorized-error'

export async function signOut(app: FastifyInstance) {
  app.post('/sign-out', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqWithSignOut = request as FastifyRequest & { signOut?: () => void }

    if (typeof reqWithSignOut.signOut !== 'function') {
      throw new UnauthorizedError('Sign-out method not available')
    }

    reqWithSignOut.signOut()

    return reply.status(204).send()
  })
}
