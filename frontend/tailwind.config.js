/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'DM Sans',
          'Inter',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        primary: {
          50: '#f0f2f6',
          100: '#dce1ec',
          200: '#b5bfd6',
          300: '#8a9abc',
          400: '#5e74a1',
          500: '#1a3a6b',
          600: '#0d2750',
          700: '#061a3d',
          800: '#000E2F',
          900: '#000820',
        },
        uconn: {
          blue: '#000E2F',
          'blue-light': '#1a3a6b',
          'blue-lighter': '#5e74a1',
        },
      },
      backgroundImage: {
        'login': "url('/images/background1.jpg')",
        'login-sm': "url('/images/background2.jpg')",
        'app': "url('/images/background3.jpg')",
        'app-sm': "url('/images/background4.jpg')",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
