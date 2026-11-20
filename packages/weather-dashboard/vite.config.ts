import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Weather Dashboard',
        short_name: 'Weather',
        description: 'Private weather dashboard for Tempest observations',
        theme_color: '#16324f',
        background_color: '#f7f7ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/weather-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/weather-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/weather-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
