import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
  port: 5173,
  strictPort: true, // si el puerto está ocupado, falla en lugar de moverse a otro
  proxy: {
    // Todo lo que empiece por /api se reenvía al backend. Para el navegador,
    // la app y la API comparten origen: no hace falta CORS.
    '/api': { target: 'http://localhost:3000' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
