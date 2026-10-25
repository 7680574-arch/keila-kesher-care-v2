import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// The Base44 Vite plugin is removed (it also provided the "@" alias, which is restored here).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
