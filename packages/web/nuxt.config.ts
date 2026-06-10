export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      // overridden at runtime by NUXT_PUBLIC_API_BASE env var
      apiBase: 'http://localhost:3001/api',
    },
  },
  app: {
    head: {
      title: 'ModelClash',
      meta: [{ name: 'description', content: 'Compare AI models side-by-side' }],
    },
  },
  ssr: false,
})
