import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { db } from '@/db/connection'
import { users } from '@/db/schema'
import { z } from 'zod'

const registerCustomerBodySchema = z.object({
  name: z.string().min(1),
  phone: z.string(),
  email: z.string().email(),
})

type RegisterCustomerBody = z.infer<typeof registerCustomerBodySchema>

export async function registerCustomer(app: FastifyInstance) {
  app.post('/customers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, phone, email } = registerCustomerBodySchema.parse(request.body)

    await db.insert(users).values({
      name,
      email,
      phone,
    })

    reply.status(201).send()
  })
}
