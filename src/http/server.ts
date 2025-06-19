import 'dotenv/config'

import Fastify from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import fastifyJwt from '@fastify/jwt'
import cors from '@fastify/cors'

import authentication from './authentication'

import { registerRestaurant } from './routes/register-restaurant'
import { registerCustomer } from './routes/register-customer'
import { sendAuthenticationLink } from './routes/send-authentication-link'
import { createOrder } from './routes/create-order'
import { approveOrder } from './routes/approve-order'
import { cancelOrder } from './routes/cancel-order'
import { getOrders } from './routes/get-orders'
import { createEvaluation } from './routes/create-evaluation'
import { getEvaluations } from './routes/get-evaluations'
import { updateMenu } from './routes/update-menu'
import { updateProfile } from './routes/update-profile'
import { getProfile } from './routes/get-profile'
import { authenticateFromLink } from './routes/authenticate-from-link'
import { getManagedRestaurant } from './routes/get-managed-restaurant'
import { signOut } from './routes/sign-out'
import { getOrderDetails } from './routes/get-order-details'
import { getMonthReceipt } from './routes/get-month-receipt'
import { getMonthOrdersAmount } from './routes/get-month-orders-amount'
import { getDayOrdersAmount } from './routes/get-day-orders-amount'
import { getMonthCanceledOrdersAmount } from './routes/get-month-canceled-orders-amount'
import { getDailyReceiptInPeriod } from './routes/get-daily-receipt-in-period'
import { getPopularProducts } from './routes/get-popular-products'
import { dispatchOrder } from './routes/dispatch-order'
import { deliverOrder } from './routes/deliver-order'
import { checkDatabaseConnection } from '@/utils/check-database-connection'

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

await app.register(authentication)

app.register(approveOrder)
app.register(authenticateFromLink)
app.register(cancelOrder)
app.register(createEvaluation)
app.register(createOrder)
app.register(deliverOrder)
app.register(dispatchOrder)
app.register(getDailyReceiptInPeriod)
app.register(getDayOrdersAmount)
app.register(getEvaluations)
app.register(getManagedRestaurant)
app.register(getMonthCanceledOrdersAmount)
app.register(getMonthOrdersAmount)
app.register(getMonthReceipt)
app.register(getOrderDetails)
app.register(getOrders)
app.register(getPopularProducts)
app.register(getProfile)
app.register(registerCustomer)
app.register(registerRestaurant)
app.register(sendAuthenticationLink)
app.register(signOut)
app.register(updateMenu)
app.register(updateProfile)

app.setErrorHandler((error, request, reply) => {
  if ((error as any).validation) {
    reply.status(400).send({ message: 'Validation error', details: (error as any).validation })
  } else if ((error as any).code === 'FST_ERR_NOT_FOUND') {
    reply.status(404).send({ message: 'Not Found' })
  } else {
    request.log.error(error)
    reply.status(500).send({ message: 'Internal Server Error' })
  }
})

await checkDatabaseConnection()

try {
  const address = await app.listen({ port: 3333, host: '0.0.0.0' })
  console.log(`🍕 pizza.shop api is running on HTTP server ${address}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}