import { describe, it, expect, vi } from 'vitest'

vi.mock('@/env', () => ({
  env: {
    JWT_SECRET: 'supersecret',
  },
}))

import { env } from '@/env'

describe('Env vars (mocked)', () => {
  it('should load mocked env values from __mocks__', () => {
    expect(env.JWT_SECRET).toBeDefined()
    expect(env.JWT_SECRET).toBe('supersecret')
  })
})
