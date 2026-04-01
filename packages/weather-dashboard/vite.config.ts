import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'Weather Dashboard',
        short_name: 'Weather',
        description: 'Private weather dashboard for Tempest observations',
        theme_color: '#16324f',
        background_color: '#f7f7ef',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
});
