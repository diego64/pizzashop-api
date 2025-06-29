import { describe, it, expect } from 'vitest'
import { resend } from './client'
import { Resend } from 'resend'

describe('resend client', () => {
  it('should be instantiated with the correct API key', () => {
    const typedResend = resend as Resend
    expect(typedResend).toBeDefined()
    expect(typeof typedResend.emails).toBe('object')
  })
})