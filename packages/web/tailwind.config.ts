import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      screens: {
        // Small phones in portrait — below this, response headers wrap badly.
        xs: '480px',
      },
      colors: {
        // Intermediate slate steps the UI reaches for but Tailwind doesn't ship.
        slate: {
          650: '#3d4c60',
          850: '#172033',
        },
        // Semantic aliases so a rebrand is a one-line change.
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          900: '#4c1d95',
        },
      },
      // 4px base scale — matches the 1.5/2.5/4.5 steps used across the app.
      borderRadius: {
        card: '0.875rem',
      },
      boxShadow: {
        // Soft, layered elevation instead of a single heavy drop shadow.
        panel: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.12)',
        overlay: '0 4px 12px rgb(15 23 42 / 0.08), 0 24px 48px -12px rgb(15 23 42 / 0.28)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'slide-up': 'slide-up 200ms cubic-bezier(.2,0,0,1)',
      },
      transitionTimingFunction: {
        emphasized: 'cubic-bezier(.2,0,0,1)',
      },
    },
  },
  darkMode: 'class',
} satisfies Config
