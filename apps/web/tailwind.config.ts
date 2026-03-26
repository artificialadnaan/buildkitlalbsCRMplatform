import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0f172a',
        surface: '#1e293b',
        border: '#334155',
        brand: '#1F4D78',
      },
    },
  },
  plugins: [],
} satisfies Config;
