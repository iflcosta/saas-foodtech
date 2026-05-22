/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA do PDV — manifest stub (V1.0). Estratégia `autoUpdate` para que novas versões
// instalem em segundo plano; o brief de design system trata estados de resiliência (§3.4, §5).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SaaS Foodtech PDV',
        short_name: 'PDV',
        background_color: '#0F1115',
        theme_color: '#0F1115',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
  },
});
