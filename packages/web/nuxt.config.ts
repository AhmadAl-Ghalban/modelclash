export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // overridden at runtime by NUXT_PUBLIC_API_BASE env var
      apiBase: 'http://localhost:3001/api',
    },
  },
  app: {
    head: {
      title: 'ModelClash',
      meta: [
        { name: 'description', content: 'Compare AI models side-by-side' },
        // Lets the browser paint form controls and scrollbars to match the theme.
        { name: 'color-scheme', content: 'light dark' },
      ],
    },
  },
  // All data is fetched client-side from the NestJS API, so there is nothing to
  // pre-render. `ssr: false` is not used: it hits a builder bug in Nuxt 3.21
  // ("No entry found in rollupOptions.input"). Rendering the static shell on the
  // server is also better for first paint.
})
