import { describe, it, expect } from 'vitest'
import { NotAManagerError } from './not-a-manager-error'

describe('NotAManagerError', () => {
  it('should be instance of Error', () => {
    const error = new NotAManagerError()
    expect(error).toBeInstanceOf(Error)
  })

  it('should have the correct message', () => {
    const error = new NotAManagerError()
    expect(error.message).toBe('User is not a restaurant manager.')
  })

  it('should have the correct name', () => {
    const error = new NotAManagerError()
    expect(error.name).toBe('NotAManagerError')
  })
})
