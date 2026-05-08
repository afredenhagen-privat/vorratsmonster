import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const REPO_NAME = 'vorratsmonster';

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? `/${REPO_NAME}/` : '/';

  return {
    base,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png'
        ],
        manifest: {
          name: 'Vorratsmonster',
          short_name: 'Vorrat',
          description:
            'Vorrats- und MHD-Tracker mit Barcode-Scanner.',
          theme_color: '#16a34a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          lang: 'de',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          navigateFallback: `${base}index.html`
        },
        devOptions: {
          enabled: false
        }
      })
    ],
    server: {
      host: true,
      port: 5173
    },
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/__tests__/setup.js']
    }
  };
});
