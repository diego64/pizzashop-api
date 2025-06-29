import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { sendAuthenticationLink } from './send-authentication-link'
import { db } from '@/db/connection'
import { authLinks } from '@/db/schema'
import { createId } from '@paralleldrive/cuid2'

vi.mock('@/db/connection', () => {
  return {
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'some-id' }])),
        })),
      })),
    },
  }
})

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'fixed-code'),
}))

describe('sendAuthenticationLink route', () => {
  let app: ReturnType<typeof Fastify>
  let originalConsoleLog: typeof console.log

  beforeEach(async () => {
    originalConsoleLog = console.log
    console.log = vi.fn()

    process.env.API_BASE_URL = 'http://localhost'
    process.env.AUTH_REDIRECT_URL = 'https://app.test/redirect'

    app = Fastify()
    await sendAuthenticationLink(app)
    await app.ready()
  })

  afterEach(async () => {
    console.log = originalConsoleLog
    await app.close()
    vi.clearAllMocks()
  })

  it('should return 204 and log link when email exists', async () => {
    ;(db.query.users.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      email: 'john@example.com',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: { email: 'john@example.com' },
    })

    expect(res.statusCode).toBe(204)
    expect(console.log).toHaveBeenCalled()
    const logged = (console.log as any).mock.calls[0][0] as string
    expect(logged).toContain('http://localhost/auth-links/authenticate?code=fixed-code')
    expect(logged).toContain('auth-links/authenticate?code=fixed-code')
    expect(createId).toHaveBeenCalled()
  })

  it('should return 401 when user not found', async () => {
    ;(db.query.users.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: { email: 'no@mail.com' },
    })

    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res.body)
    expect(body.message).toBe('You are not authorized to access this resource.')
    expect(body.error).toBe('Unauthorized')
    expect(console.log).not.toHaveBeenCalled()
  })

  it('should return 400 when payload is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: { email: 'invalid-email' }, // supondo que há validação para email válido
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toBe('Bad Request')
    expect(body.message).toMatch(/email/)
    expect(console.log).not.toHaveBeenCalled()
  })

  it('should return 500 on unexpected error', async () => {
    ;(db.query.users.findFirst as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB broken'))

    const res = await app.inject({
      method: 'POST',
      url: '/authenticate',
      payload: { email: 'john@example.com' },
    })

    expect(res.statusCode).toBe(500)
    const body = JSON.parse(res.body)
    expect(body.error).toBe('Internal Server Error')
    expect(body.message).toBe('DB broken')
    expect(console.log).not.toHaveBeenCalled()
  })
})
