/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        mono: ['JetBrains Mono', 'monospace'],
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
        accent: {
          blue: '#3b7dd8',
          orange: '#ffbc0e',
          'orange-hover': '#e6a800',
          teal: '#00A99D',
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
        'slide-up-delay': 'slideUp 0.5s ease-out 0.1s both',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
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
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(0,14,47,0.1), 0 0 16px rgba(0,14,47,0.05)' },
          '50%': { boxShadow: '0 0 0 1px rgba(0,14,47,0.2), 0 0 24px rgba(0,14,47,0.1)' },
        },
      },
      boxShadow: {
        'glass': '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'glass-hover': '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        'glass-float': '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        'glow-blue': '0 4px 16px rgba(59,125,216,0.30), 0 0 32px rgba(59,125,216,0.14)',
        'glow-primary': '0 4px 16px rgba(0,14,47,0.30), 0 0 32px rgba(0,14,47,0.14)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
