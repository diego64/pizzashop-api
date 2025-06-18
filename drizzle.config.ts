import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';
import { parse } from 'pg-connection-string';

config();

const parsed = parse(process.env.DATABASE_URL!);

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: parsed.host!,
    port: parsed.port ? parseInt(parsed.port) : 5432,
    user: parsed.user!,
    password: parsed.password!,
    database: parsed.database!,
    ssl: false,
  },
} satisfies Config;