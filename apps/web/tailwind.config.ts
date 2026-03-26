import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1a2e',
        surface: '#ffffff',
        border: '#e5e7eb',
        brand: {
          DEFAULT: '#d4a054',
          dark: '#b8863c',
          light: '#e8c48a',
          50: '#fdf8ef',
          100: '#f9ecda',
          500: '#d4a054',
          600: '#b8863c',
          700: '#96692e',
          900: '#1a1a2e',
        },
        navy: {
          DEFAULT: '#1a1a2e',
          50: '#f0f0f5',
          100: '#e0e0eb',
          200: '#c1c1d6',
          300: '#9494b3',
          400: '#6b6b8a',
          500: '#4a4a66',
          600: '#33334d',
          700: '#262640',
          800: '#1f1f35',
          900: '#1a1a2e',
          950: '#0f0f1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(212, 160, 84, 0.15)',
      },
    },
  },
  plugins: [],
} satisfies Config;
