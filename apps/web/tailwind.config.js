/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1320px'
      }
    },
    extend: {
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        brand: {
          50: '#f1f6ff',
          100: '#e2edff',
          200: '#c0d9ff',
          300: '#94c0ff',
          400: '#559bff',
          500: '#1d75ff',
          600: '#0557d6',
          700: '#0244a9',
          800: '#033b89',
          900: '#082f66'
        },
        accent: '#7b5cff',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at 30% 30%, var(--tw-gradient-stops))',
        'glass-light': 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 100%)',
        'glass-dark': 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(30,41,59,0.35) 100%)'
      },
      boxShadow: {
        'glow': '0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px -2px rgba(0,0,0,0.35)',
        'brand': '0 4px 16px -2px rgba(29,117,255,0.45)'
      },
      keyframes: {
        'float': {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'pulse-soft': {
          '0%,100%': { opacity: 0.4 },
          '50%': { opacity: 1 }
        },
        'shine': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
        shine: 'shine 2.5s linear infinite'
      }
    }
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          '@apply backdrop-blur-md border border-white/10 shadow-glow': {},
          'background': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)'
        },
        '.glass-dark': {
          '@apply backdrop-blur-md border border-slate-700/70 shadow-glow': {},
          'background': 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(30,41,59,0.35) 100%)'
        }
      })
    }
  ],
}
