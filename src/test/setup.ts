import { mockEnv } from '../../__mocks__/env'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
})

for (const [key, value] of Object.entries(mockEnv)) {
  process.env[key] = value
}
