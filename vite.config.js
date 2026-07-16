import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Возвращаем Tailwind на место
  ],
  base: '/', // <-- ВНИМАНИЕ: Здесь нужно оставить ТОЛЬКО название репозитория!
})