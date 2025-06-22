import 'dotenv/config'
import { createApp } from './create-app'
import { checkDatabaseConnection } from '@/utils/check-database-connection'

async function start() {
  const app = await createApp()

  await checkDatabaseConnection()

  try {
    const address = await app.listen({ port: 3333, host: '0.0.0.0' })
    console.log(`🍕 pizza.shop api is running on HTTP server ${address}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()