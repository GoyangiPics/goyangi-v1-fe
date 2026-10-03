import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests for the pure logic under app/utils — filter-string building, URL
 * serialization, rendition/thumbnail selection, slugs.
 *
 * Plain vitest rather than @nuxt/test-utils on purpose: none of this needs a
 * Nuxt runtime, and the Nuxt environment costs seconds of setup per run. If
 * component or composable tests are ever wanted (composables here call
 * auto-imported usePocketBase/useToast, so they'd need the real app context),
 * @nuxt/test-utils is the upgrade path — it layers on top of this config rather
 * than replacing it.
 *
 * The `~` alias has to be declared manually for the same reason: without Nuxt
 * resolving it, `~/utils/dateRanges` wouldn't load. Nuxt 4 points `~` at srcDir,
 * which is app/.
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
