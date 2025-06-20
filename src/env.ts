import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  AUTH_REDIRECT_URL: z.string().url(),
  DATABASE_URL: z.string().url().min(1),
  JWT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
})

export const env = envSchema.parse(process.env)
