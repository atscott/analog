/// <reference types="vitest" />

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    root: import.meta.dirname,
    cacheDir: `../../node_modules/.vitest`,
    resolve: {
      alias: {
        '@analogjs/router/tokens': resolve(
          import.meta.dirname,
          'tokens/src/index.ts',
        ),
        '@analogjs/router': resolve(import.meta.dirname, 'src/index.ts'),
        '@analogjs/content': resolve(
          import.meta.dirname,
          '../content/src/index.ts',
        ),
        '@analogjs/vite-plugin-angular/setup-vitest': resolve(
          import.meta.dirname,
          '../vite-plugin-angular/setup-vitest.ts',
        ),
      },
    },
    test: {
      reporters: ['default'],
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      typecheck: {
        enabled: true,
        tsconfig: './tsconfig.spec.json',
        ignoreSourceErrors: true,
        include: ['test/type-tests/**/*.test-d.ts'],
      },
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
