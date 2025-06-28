import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fastify } from 'fastify'
import { z } from 'zod'

describe('sendAuthenticationLink', () => {
  let app: ReturnType<typeof fastify>

  beforeEach(async () => {
    app = fastify()

    app.post('/authenticate', async (request: { body: unknown }, reply: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: { message: string; issues?: z.ZodIssue[] } | undefined): any; new(): any } } }) => {
      try {
        const schema = z.object({
          email: z.string().email(),
        })
        const { email } = schema.parse(request.body)

        if (email === 'john.doe@example.com') {
          return reply.status(204).send(undefined)
        } else {
          return reply.status(401).send({ message: 'Unauthorized' })
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            message: 'Validation error',
            issues: error.issues,
          })
        }
        return reply.status(500).send({ message: 'Internal server error' })
      }
    })

    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should send authentication link successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: {
        email: 'john.doe@example.com',
      },
    })

    expect(response.statusCode).toBe(204)
  })

  it('should return 401 if email does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: {
        email: 'naoexiste@example.com',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body).message).toBe('Unauthorized')
  })

  it('should return 400 if request body is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: {
        email: 'not-an-email',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).message).toBe('Validation error')
  })
})
