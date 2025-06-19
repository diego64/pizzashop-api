import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/http/server.ts'],
  outDir: 'build',
  format: ['esm'],
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: false,
  dts: false
})