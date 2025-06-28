import { client } from '@/db/connection'
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

vi.mock('@/db/connection', () => ({
  client: vi.fn(),
}))

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`
    console.log('====== Database connection established successfully! ======')
    return true
  } catch (error) {
    console.error('Error connecting to the database:', error)
    process.exit(1)
  }
}

// Silenciar logs apenas neste arquivo de teste
let originalConsoleLog: typeof console.log
let originalConsoleError: typeof console.error

beforeAll(() => {
  originalConsoleLog = console.log
  originalConsoleError = console.error

  console.log = vi.fn()
  console.error = vi.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

describe('checkDatabaseConnection', () => {
  let exitSpy: any

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    exitSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('should return true when the DB responds', async () => {
    vi.mocked(client).mockResolvedValueOnce({
      columns: [],
      count: 1,
      command: 'SELECT',
      statement: 'SELECT 1',
      state: 'SUCCESS',
      [Symbol.iterator]: function* () { yield {} },
    } as any)

    const result = await checkDatabaseConnection()
    expect(result).toBe(true)
    expect(client).toHaveBeenCalledWith(['SELECT 1'])
  })

  it('should call process.exit when the DB throws an error', async () => {
    vi.mocked(client).mockRejectedValueOnce(new Error('DB down'))

    await expect(checkDatabaseConnection()).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
