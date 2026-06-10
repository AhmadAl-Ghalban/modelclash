export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
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
