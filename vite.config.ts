import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

/**
 * Vite+ config: lint (`vp lint`), format (`vp fmt`) and tests (`vp test`).
 *
 * Nuxt never reads this file — it builds with its own Vite config from
 * nuxt.config.ts — so nothing here affects `nuxt dev` or `nuxt build`.
 * Type-checking is `nuxt typecheck` (Golar), which understands .vue files and
 * Nuxt's auto-imports; lint's own `typeCheck` doesn't, so it stays off.
 */
export default defineConfig({
  /**
   * Unit tests for the pure logic under app/utils — filter-string building, URL
   * serialization, rendition/thumbnail selection, slugs.
   *
   * Plain Vitest rather than @nuxt/test-utils on purpose: none of this needs a
   * Nuxt runtime, and the Nuxt environment costs seconds of setup per run. If
   * component or composable tests are ever wanted (composables here call
   * auto-imported usePocketBase/useToast, so they'd need the real app context),
   * @nuxt/test-utils is the upgrade path.
   *
   * The `~` alias has to be declared manually for the same reason: without Nuxt
   * resolving it, `~/utils/dateRanges` wouldn't load. Nuxt 4 points `~` at srcDir,
   * which is app/.
   */
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

  fmt: {
    semi: false,
    singleQuote: true,
    ignorePatterns: ['app/types/pocketbase-types.ts'],
  },

  lint: {
    categories: {
      correctness: 'error',
      suspicious: 'warn',
    },
    rules: {
      // Flags functions a composable defines and returns — the composable pattern.
      'unicorn/consistent-function-scoping': 'off',
      // Fights the deliberate `as any` fixtures in tests; type-checking covers the rest.
      'typescript/no-unsafe-type-assertion': 'off',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        // test/ isn't in any tsconfig, so `~/…` imports resolve to error types
        // there and every fixture's `as any` looks "unnecessary".
        files: ['test/**'],
        rules: {
          'typescript/no-unnecessary-type-assertion': 'off',
        },
      },
    ],
    ignorePatterns: ['app/types/pocketbase-types.ts', '.nuxt/**', '.output/**', '.claude/**'],
    options: {
      // Type-aware rules (floating promises, needless assertions…) on .ts files.
      typeAware: true,
      typeCheck: false,
      // Warnings fail too — in `vp lint` and `vp check` alike.
      denyWarnings: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
})
