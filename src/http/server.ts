import 'dotenv/config'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

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

const app = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>()

await app.register(authentication)

await app.register(cors, {
  credentials: true,
  origin: (origin, cb) => {
    cb(null, true)
  },
})

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  cookie: {
    cookieName: 'token',
    signed: false,
  },
})

app.decorate('authenticate', async function (
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ message: 'Unauthorized' })
  }
})

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
    if (error.validation) {
      reply.status(400).send({ message: 'Validation error', details: error.validation })
    } else if (error.code === 'FST_ERR_NOT_FOUND') {
      reply.status(404).send({ message: 'Not Found' })
    } else {
      request.log.error(error)
      reply.status(500).send({ message: 'Internal Server Error' })
    }
  })

try {
  const address = await app.listen({ port: 3333, host: '0.0.0.0' })
  console.log(`🔥 HTTP server running at ${address}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}