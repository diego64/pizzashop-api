import { client } from '@/db/connection'

export async function checkDatabaseConnection() {
  try {
    await client`SELECT 1`
    console.log('✅ Database connection established successfully.')
  } catch (error) {
    console.error('❌ Error connecting to the database:', error)
    process.exit(1)
  }
}