import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      watch: {
        ignored: [
          '**/cameras.json',
          '**/faces.json',
          '**/forensics.json',
          '**/clips/**',
          '**/forensics/**',
          '**/backend/**'
        ]
      },
      proxy: {
        '^/api/v1/streams/corp8-proxy/(.*)': {
          target: 'http://localhost:8089',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/v1\/streams\/corp8-proxy/, '/hls-proxy'),
        },
      },
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'leaflet-vendor': ['leaflet'],
            'lucide-icons': ['lucide-react']
          }
        }
      }
    },
    css: {
      devSourcemap: false,
    },
    esbuild: {
      legalComments: 'none',
      sourcemap: false,
      drop: ['console', 'debugger'],
    },
  };
});
