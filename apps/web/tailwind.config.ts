import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0f172a',
        surface: '#ffffff',
        border: '#e2e8f0',
        brand: '#9d4300',
        'brand-container': '#f97316',
        'surface-container': '#e7eeff',
        'surface-container-low': '#f0f3ff',
        secondary: '#515f74',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        label: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
