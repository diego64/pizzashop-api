import { describe, it, expect } from 'vitest'

describe('Env vars', () => {
  it('should load .env.test values', () => {
    expect(process.env.JWT_SECRET_TEST).toBeDefined()
    expect(process.env.JWT_SECRET_TEST).toBe('supersecret')
  })
})