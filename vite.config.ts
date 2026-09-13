import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // On GitHub Actions the build is deployed to project Pages
  // (https://mahdyaralipor.github.io/neon-void/), so assets need the
  // repo-name base. Local dev/preview keep serving from '/'.
  base: process.env.GITHUB_ACTIONS ? '/neon-void/' : '/',
  plugins: [react(), tailwindcss()],
})
