import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
<<<<<<< HEAD
        target: 'http://localhost:5000',
=======
        target: 'http://localhost:5001',
>>>>>>> kairavi
        changeOrigin: true,
        secure: false
      }
    }
  }
});
