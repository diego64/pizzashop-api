import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { registerCustomer } from './register-customer'
import { db } from '@/db/connection'
import { users } from '@/db/schema'
import { ZodError, ZodIssue } from 'zod'

vi.mock('@/db/connection', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}))

describe('registerCustomer', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(() => {
    app = Fastify()

    app.setErrorHandler((error: { issues: any }, request: any, reply: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: { message: string; issues?: ZodIssue[] }): void; new(): any } } }) => {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          message: 'Invalid request body',
          issues: error.issues,
        })
      }
      reply.status(500).send({ message: 'Internal server error' })
    })

    registerCustomer(app)
  })

  it('should register a customer and return 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/customers',
      payload: {
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(db.insert).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalledWith(users)
  })

  it('should return 400 on invalid body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/customers',
      payload: {
        name: '', // inválido
        phone: '1234567890',
        email: 'not-an-email',
      },
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('message', 'Invalid request body')
    expect(body).toHaveProperty('issues')
    expect(Array.isArray(body.issues)).toBe(true)
  })
})
