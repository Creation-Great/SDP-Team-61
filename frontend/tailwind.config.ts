import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy:           '#000E2F',
        'navy-deep':    '#00071A',
        'navy-mid':     '#001535',
        'tech-blue':    '#4B9FE1',
        'uconn-orange': '#E87722',
        success:        '#3DBB79',
        danger:         '#E05C5C',
      },
    },
  },
  plugins: [],
} satisfies Config
