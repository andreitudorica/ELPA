/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

// rollup-plugin-visualizer declares its types against rollup, which is not a
// dependency here (Vite bundles rolldown); the runtime plugin API is compatible.
const analyzePlugin = (): PluginOption =>
  visualizer({
    filename: 'stats.html',
    open: true,
    gzipSize: true,
    brotliSize: true,
  }) as PluginOption;

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/app/router/routes',
      generatedRouteTree: 'src/app/router/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    ...(mode === 'analyze' ? [analyzePlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  preview: {
    port: 4273,
    strictPort: true,
  },
  build: {
    sourcemap: mode === 'analyze',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.tsx',
        'src/test/**',
        'src/mocks/**',
        'src/app/router/routeTree.gen.ts',
        'src/main.tsx',
        'src/**/types/**',
        'src/**/*.d.ts',
      ],
    },
  },
}));
