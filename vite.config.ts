import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Improve chunk splitting for faster initial load
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor';
          }
          // UI utilities
          if (id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/sonner') ||
              id.includes('node_modules/cmdk')) {
            return 'ui-vendor';
          }
          // Data & utilities
          if (id.includes('node_modules/@supabase') ||
              id.includes('node_modules/@tanstack') ||
              id.includes('node_modules/zod') ||
              id.includes('node_modules/date-fns')) {
            return 'data-vendor';
          }
          // PDF export
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
            return 'pdf-vendor';
          }
          // Excel export
          if (id.includes('node_modules/xlsx')) {
            return 'excel-vendor';
          }
          // QR code
          if (id.includes('node_modules/qrcode') || id.includes('node_modules/html5-qrcode')) {
            return 'qr-vendor';
          }
          // Charts
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor';
          }
        },
      },
    },
    // Enable source maps for easier debugging in production
    sourcemap: false,
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
}));