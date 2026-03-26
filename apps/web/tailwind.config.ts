import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1F4D78',
        surface: '#ffffff',
        border: '#e2e8f0',
        brand: '#1F4D78',
      },
    },
  },
  plugins: [],
} satisfies Config;
