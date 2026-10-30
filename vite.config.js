import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Without this the build produced 31 separate JavaScript files, 13 of
        // them tiny single-icon files. On a laptop that is invisible; on a
        // phone every file is its own round trip and the waiting adds up far
        // more than the bytes do. Grouping the libraries into a few stable
        // files cuts the number of requests sharply, and because each group
        // changes rarely, the browser can keep reusing them between deploys.
        manualChunks(id) {
          // ONLY the icon library is grouped, and deliberately nothing else.
          //
          // The build was producing 13 tiny single-icon files, so every page
          // the owner opened fetched a handful of them separately. Collecting
          // them into one file removes that.
          //
          // Grouping the other libraries was tried and MADE THINGS WORSE: it
          // turned the 3 files fetched before sign-in into 8, because each
          // named group gets preloaded. React, Supabase and the router are
          // needed immediately anyway, so Vite's own grouping is already the
          // right one. The charting library is left alone too - naming it
          // caused the build to preload 368 KB of charts before sign-in.
          if (id.includes('node_modules') && id.includes('lucide-react')) return 'icons';
        }
      }
    }
  }
})
