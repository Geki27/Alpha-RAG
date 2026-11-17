import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'marked',
        'katex',
        'motion',
        'three',
      ],
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-three-core',
                test: /node_modules[\\/]three[\\/]/,
                priority: 26,
              },
              {
                name: 'vendor-r3f',
                test: /node_modules[\\/](@react-three|maath|three-stdlib|camera-controls|troika-.*)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-markdown',
                test: /node_modules[\\/](marked|katex)[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-ui',
                test: /node_modules[\\/](motion|framer-motion|lucide-react)[\\/]/,
                priority: 15,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
