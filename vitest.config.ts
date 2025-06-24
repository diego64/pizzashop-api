import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 50_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'src/http/server.ts',
        'src/db/**',
        'src/@types/**'
      ],
    },
    include: ['src/**/*.{test,spec}.{ts,js}']
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
