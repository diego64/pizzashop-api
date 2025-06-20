import { FastifyInstance } from 'fastify'

import authentication from './authentication'

import { approveOrder } from './routes/approve-order'
import { authenticateFromLink } from './routes/authenticate-from-link'
import { cancelOrder } from './routes/cancel-order'
import { createEvaluation } from './routes/create-evaluation'
import { createOrder } from './routes/create-order'
import { deliverOrder } from './routes/deliver-order'
import { dispatchOrder } from './routes/dispatch-order'
import { getDailyReceiptInPeriod } from './routes/get-daily-receipt-in-period'
import { getDayOrdersAmount } from './routes/get-day-orders-amount'
import { getEvaluations } from './routes/get-evaluations'
import { getManagedRestaurant } from './routes/get-managed-restaurant'
import { getMonthCanceledOrdersAmount } from './routes/get-month-canceled-orders-amount'
import { getMonthOrdersAmount } from './routes/get-month-orders-amount'
import { getMonthReceipt } from './routes/get-month-receipt'
import { getOrderDetails } from './routes/get-order-details'
import { getOrders } from './routes/get-orders'
import { getPopularProducts } from './routes/get-popular-products'
import { getProfile } from './routes/get-profile'
import { registerCustomer } from './routes/register-customer'
import { registerRestaurant } from './routes/register-restaurant'
import { sendAuthenticationLink } from './routes/send-authentication-link'
import { signOut } from './routes/sign-out'
import { updateMenu } from './routes/update-menu'
import { updateProfile } from './routes/update-profile'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authentication)

  await app.register(approveOrder)
  await app.register(authenticateFromLink)
  await app.register(cancelOrder)
  await app.register(createEvaluation)
  await app.register(createOrder)
  await app.register(deliverOrder)
  await app.register(dispatchOrder)
  await app.register(getDailyReceiptInPeriod)
  await app.register(getDayOrdersAmount)
  await app.register(getEvaluations)
  await app.register(getManagedRestaurant)
  await app.register(getMonthCanceledOrdersAmount)
  await app.register(getMonthOrdersAmount)
  await app.register(getMonthReceipt)
  await app.register(getOrderDetails)
  await app.register(getOrders)
  await app.register(getPopularProducts)
  await app.register(getProfile)
  await app.register(registerCustomer)
  await app.register(registerRestaurant)
  await app.register(sendAuthenticationLink)
  await app.register(signOut)
  await app.register(updateMenu)
  await app.register(updateProfile)
}