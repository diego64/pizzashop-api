import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie' // <-- IMPORTAR cookie
import jwt from '@fastify/jwt'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { registerRoutes } from './routes'

export async function createApp() {
  //server creation
  const app = Fastify().withTypeProvider<ZodTypeProvider>()

  await app.register(cookie)

  //JWT middleware
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'auth', signed: false },
  })

  //CORS
  await app.register(cors, {
    credentials: true,
    origin: true,
  })

  //authentication
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
	  // Adicione o return para interromper a execução e enviar a resposta
    } catch {
      return reply.status(401).send({ message: 'Unauthorized' })
    }
  })

  await registerRoutes(app)
  //routes
  app.get('/protected-route', { preValidation: [app.authenticate] }, async () => {
    return { ok: true }
  })

  //error handling
  app.get('/error', async () => {
    throw new Error('Simulated internal error')
  })

  app.setErrorHandler((error, request, reply) => {
    if ((error as any).validation) {
      reply.status(400).send({ message: 'Validation error', details: (error as any).validation })
    } else if ((error as any).code === 'FST_ERR_NOT_FOUND') {
      reply.status(404).send({ message: error.message })
    } else {
      request.log.error(error)
      reply.status(500).send({ message: 'Internal Server Error' })
    }
  })

  //reuse for testing and production
  return app
}
