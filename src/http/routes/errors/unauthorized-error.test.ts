import { describe, it, expect } from 'vitest'
import { UnauthorizedError } from './unauthorized-error'

describe('UnauthorizedError', () => {
  it('should be instance of Error', () => {
    const error = new UnauthorizedError()
    expect(error).toBeInstanceOf(Error)
  })

  it('should have the correct default message', () => {
    const error = new UnauthorizedError()
    expect(error.message).toBe('Unauthorized')
  })

  it('should have the correct name', () => {
    const error = new UnauthorizedError()
    expect(error.name).toBe('UnauthorizedError')
  })

  it('should accept a custom message', () => {
    const customMessage = 'Token expired'
    const error = new UnauthorizedError(customMessage)
    expect(error.message).toBe(customMessage)
  })
})
