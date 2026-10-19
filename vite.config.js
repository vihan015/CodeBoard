import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' lets you host the build in any folder or sub-path
export default defineConfig({ base: './', plugins: [react()] })
