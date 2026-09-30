import './ui/styles.css';
import { App } from './app';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const app = new App(canvas, hud);
// Debug/automation hook (also handy for reproducing a round with ?seed=<hex>).
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __molesweeper: App }).__molesweeper = app;
}

// PWA: precached by vite-plugin-pwa, updates itself in the background.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
