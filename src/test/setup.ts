import { mockEnv } from '../../__mocks__/env'
import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
})

for (const [key, value] of Object.entries(mockEnv)) {
  process.env[key] = value
}

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['test/setup.ts'],
  },
})