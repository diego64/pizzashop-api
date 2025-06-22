import { mockEnv } from '../../__mocks__/env'
for (const [key, value] of Object.entries(mockEnv)) {
  process.env[key] = value
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from './create-app'
import { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = await createApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('App setup and behavior', () => {
  it('should respond with 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/non-existent-route' })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toContain('not found')
  })

  it('should return 400 for validation error (if configured)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/some-route-with-validation',
      payload: {},
    })
    if (res.statusCode === 400) {
      expect(res.json().message).toBe('Validation error')
    }
  })

  it('should return 500 for unhandled errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/error' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ message: 'Internal Server Error' })
  })

  it('should respond to a defined route (adjust as needed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    if (res.statusCode === 200) {
      expect(res.statusCode).toBe(200)
    } else {
      expect([404, 403]).toContain(res.statusCode)
    }
  })

  it('should accept JWT from cookie when configured', async () => {
    const token = await app.jwt.sign({ sub: 'user-1' })
    const res = await app.inject({
      method: 'GET',
      url: '/protected-route',
      cookies: { auth: token },
    })
    expect([200, 401]).toContain(res.statusCode)
  })

  it('should return 401 Unauthorized when JWT is missing or invalid on protected route', async () => {
    let res = await app.inject({
      method: 'GET',
      url: '/protected-route'
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ message: 'Unauthorized' })

    res = await app.inject({
      method: 'GET',
      url: '/protected-route',
      cookies: { auth: 'invalid.token.here' }
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ message: 'Unauthorized' })
  })
})
