// test/setup.ts

import dotenv from 'dotenv'
import path from 'path'
import { mockEnv } from '../../__mocks__/env'
import { beforeAll, afterAll, vi } from 'vitest'

dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
})

for (const [key, value] of Object.entries(mockEnv)) {
  process.env[key] = value
}

let originalStdoutWrite: typeof process.stdout.write
let originalStderrWrite: typeof process.stderr.write

beforeAll(() => {
  originalStdoutWrite = process.stdout.write
  originalStderrWrite = process.stderr.write

  process.stdout.write = vi.fn() as any
  process.stderr.write = vi.fn() as any
})

afterAll(() => {
  process.stdout.write = originalStdoutWrite
  process.stderr.write = originalStderrWrite
})
