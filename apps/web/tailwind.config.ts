import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0a0f1a',
        surface: '#111827',
        border: '#1e293b',
        brand: '#1F4D78',
      },
    },
  },
  plugins: [],
} satisfies Config;
