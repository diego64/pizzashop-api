import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildApp } from './build-app'
import { UnauthorizedError } from '@/http/routes/errors/unauthorized-error'
import { NotAManagerError } from '@/http/routes/errors/not-a-manager-error'
import Fastify, { FastifyInstance } from 'fastify'

describe('buildApp', () => {
  let app: FastifyInstance

  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn
  const originalConsoleLog = console.log

  beforeEach(async () => {
    // Silencia logs
    console.error = vi.fn()
    console.warn = vi.fn()
    console.log = vi.fn()

    const mockRegisterRoutes = vi.fn(async (appInstance) => {
      appInstance.get('/test', async (_req: any, _res: any) => {
        return { success: true }
      })
    })

    app = await buildApp(mockRegisterRoutes)
  })

  afterEach(async () => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    console.log = originalConsoleLog
    if (app?.close) await app.close()
  })

  it('must create the app and record a test route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
  })

  it('should return 401 for UnauthorizedError', async () => {
    const errorApp = Fastify()
    errorApp.setErrorHandler(app.errorHandler)

    errorApp.get('/unauthorized', async () => {
      throw new UnauthorizedError()
    })

    await errorApp.ready()

    const response = await errorApp.inject({
      method: 'GET',
      url: '/unauthorized',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      code: 'UNAUTHORIZED',
      message: 'You are not authorized to access this resource.',
    })

    await errorApp.close()
  })

  it('should return 403 for NotAManagerError', async () => {
    const errorApp = Fastify()
    errorApp.setErrorHandler(app.errorHandler)

    errorApp.get('/forbidden', async () => {
      throw new NotAManagerError()
    })

    await errorApp.ready()

    const response = await errorApp.inject({
      method: 'GET',
      url: '/forbidden',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.',
    })

    await errorApp.close()
  })

  it('should return 500 for generic errors', async () => {
    const errorApp = Fastify()
    errorApp.setErrorHandler(app.errorHandler)

    errorApp.get('/error', async () => {
      throw new Error('Unexpected failure')
    })

    await errorApp.ready()

    const response = await errorApp.inject({
      method: 'GET',
      url: '/error',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    })

    await errorApp.close()
  })
})
