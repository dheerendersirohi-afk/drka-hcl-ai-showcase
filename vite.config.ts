import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mapbox-gl')) {
              return 'mapbox';
            }

            if (id.includes('react-map-gl')) {
              return 'react-map-gl';
            }

            if (id.includes('cobe')) {
              return 'globe-vendor';
            }

            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'charts';
            }

            if (id.includes('@supabase/supabase-js')) {
              return 'supabase';
            }

            if (id.includes('lucide-react')) {
              return 'icons';
            }

            if (id.includes('react') || id.includes('scheduler')) {
              return 'react';
            }
          }

          if (id.includes('/src/components/Map.tsx')) {
            return 'map-screen';
          }

          if (id.includes('/src/components/Globe.tsx')) {
            return 'globe-screen';
          }

          if (id.includes('/src/components/Analytics.tsx')) {
            return 'analytics-screen';
          }
        },
      },
    },
  },
});
