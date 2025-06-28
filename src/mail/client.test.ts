import { describe, it, expect, vi, beforeEach } from 'vitest'

const resendConstructorMock = vi.fn()

vi.mock('@/env', () => ({
  env: {
    RESEND_API_KEY: 'fake-api-key',
  },
}))

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation((apiKey: string) => {
      resendConstructorMock(apiKey)
      return { sendEmail: vi.fn() }
    }),
  }
})

describe('resend instance', () => {
  let resend: any
  let Resend: any

  beforeEach(async () => {
    // Só importa o módulo após os mocks estarem ativos
    const clientModule = await import('./client')
    resend = clientModule.resend

    // Também importa o mock da classe
    const resendModule = await import('resend')
    Resend = resendModule.Resend
  })

  it('must instantiate Resend with the environment variable key', () => {
    expect(resendConstructorMock).toHaveBeenCalledWith('fake-api-key')
    expect(resend).toHaveProperty('sendEmail')
  })

  it('must be a "mocked" instance of Resend', () => {
    expect(Resend).toHaveBeenCalledTimes(1)
  })
})
