import { describe, it, expect, vi } from 'vitest'
import authentication from './authentication'
import { registerRoutes } from './routes'

import { approveOrder } from './routes/approve-order'
import { authenticateFromLink } from './routes/authenticate-from-link'
import { cancelOrder } from './routes/cancel-order'

describe('registerRoutes', () => {
  it('should register all routes and plugins', async () => {
    const app = {
      register: vi.fn(),
    }

    await registerRoutes(app as any)

    expect(app.register.mock.calls[0][0]).toBe(authentication)

    const registeredPlugins = app.register.mock.calls.map(call => call[0])

    expect(registeredPlugins).toContain(approveOrder)
    expect(registeredPlugins).toContain(authenticateFromLink)
    expect(registeredPlugins).toContain(cancelOrder)

    expect(app.register.mock.calls.length).toBeGreaterThanOrEqual(24)
  })
})
