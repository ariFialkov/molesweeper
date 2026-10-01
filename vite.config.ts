import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// MOLESWEEPER_PWA=off builds a plain static site (no manifest, no service worker) for hosts
// that only accept standard WebGL build files. The default `npm run build` uses that mode;
// `npm run build:pwa` produces the installable PWA.
const pwaOff = process.env.MOLESWEEPER_PWA === 'off';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      disable: pwaOff,
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Molesweeper',
        short_name: 'Molesweeper',
        description: 'Slingshot firecrackers into a 3D backyard. Find moles, dodge mines, cash out.',
        theme_color: '#2b1d12',
        background_color: '#2b1d12',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
