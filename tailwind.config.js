/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#13131b',
        surface: {
          DEFAULT: '#1f1f27',
          dim: '#13131b',
          bright: '#393841',
          lowest: '#0d0d15',
          low: '#1b1b23',
          high: '#292932',
          highest: '#34343d',
        },
        ink: {
          DEFAULT: '#e4e1ed',
          muted: '#c7c4d7',
          dim: '#908fa0',
        },
        outline: {
          DEFAULT: '#908fa0',
          variant: '#464554',
        },
        primary: {
          DEFAULT: '#c0c1ff',
          container: '#8083ff',
          on: '#1000a9',
          onContainer: '#0d0096',
          inverse: '#494bd6',
          fixed: '#e1e0ff',
          fixedDim: '#c0c1ff',
        },
        secondary: {
          DEFAULT: '#4edea3',
          container: '#00a572',
          on: '#003824',
          onContainer: '#00311f',
        },
        tertiary: {
          DEFAULT: '#ffb783',
          container: '#d97721',
          on: '#4f2500',
          onContainer: '#452000',
        },
        danger: {
          DEFAULT: '#ffb4ab',
          container: '#93000a',
          on: '#690005',
          onContainer: '#ffdad6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'h1': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['14px', { lineHeight: '20px' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        'mono-md': ['13px', { lineHeight: '20px' }],
      },
      borderRadius: {
        'sm': '0.25rem',
        DEFAULT: '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
      },
      spacing: {
        'gutter': '20px',
        'margin': '24px',
      },
      boxShadow: {
        'focus': '0 0 0 2px rgba(192, 193, 255, 0.35)',
        'glow': '0 0 24px rgba(128, 131, 255, 0.25)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(192, 193, 255, 0.6)' },
          '50%': { boxShadow: '0 0 0 8px rgba(192, 193, 255, 0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
