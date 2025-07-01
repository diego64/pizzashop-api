import Fastify, { FastifyInstance, FastifyLoggerInstance } from 'fastify'
import authenticationPlugin from '../../http/authentication'
import { UnauthorizedError } from '@/http/routes/errors/unauthorized-error'
import { NotAManagerError } from '@/http/routes/errors/not-a-manager-error'

interface BuildAppOptions {
  logger?: FastifyLoggerInstance
}

export async function buildApp(
  registerRoutes: (app: FastifyInstance) => Promise<void> | void,
  options?: BuildAppOptions
) {
  const app = Fastify({
    logger: options?.logger ?? { level: 'info' },
    pluginTimeout: 500_000,
  })

  await app.register(authenticationPlugin)

  try {
    await registerRoutes(app)
  } catch (err) {
    app.log.error('Error registering routes:', err)
    throw err
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'You are not authorized to access this resource.',
      })
    }

    if (error instanceof NotAManagerError) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource.',
      })
    }

    request.log.error(error, 'Internal server error')

    return reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    })
  })

  await app.ready()

  return app
}
