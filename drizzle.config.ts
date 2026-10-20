import { defineConfig } from 'drizzle-kit';

// Migration üretmek için: npx drizzle-kit generate
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
