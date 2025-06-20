import 'dotenv/config'

import Fastify from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import fastifyJwt from '@fastify/jwt'
import cors from '@fastify/cors'

import { checkDatabaseConnection } from '@/utils/check-database-connection'
import { registerRoutes } from './routes'
import { errorHandler } from './routes/errors/error-handler'

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  },
}).withTypeProvider<ZodTypeProvider>()

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'senhaprahomolagacao',
  cookie: {
    cookieName: 'auth',
    signed: false,
  },
})

await app.register(cors, {
  credentials: true,
  origin: (origin, cb) => cb(null, true),
})

await registerRoutes(app)

app.setErrorHandler(errorHandler)

await checkDatabaseConnection()

try {
  const address = await app.listen({ port: 3333, host: '0.0.0.0' })
  console.log(`🍕 pizza.shop api is running on HTTP server ${address}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
