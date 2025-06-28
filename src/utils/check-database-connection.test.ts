import { client } from '@/db/connection'
import { checkDatabaseConnection } from './check-database-connection'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@/db/connection', () => ({
  client: vi.fn(),
}))

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
      [Symbol.iterator]: function* () {
        yield {}
      },
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
