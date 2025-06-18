import 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => Promise<void>
  }

  interface FastifyRequest {
    signUser: (payload: { sub: string; restaurantId?: string }) => Promise<void>
  }
}