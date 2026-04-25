import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-bengali)', 'sans-serif'],
        bengali: ['var(--font-bengali)', 'var(--font-inter)', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        teal: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
          400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
          800: '#115E59', 900: '#134E4A',
        },
        coral: {
          50: '#FEF2F2', 100: '#FEE4E2', 400: '#FDA29B',
          500: '#F97066', 600: '#D92D20',
        },
        stone: {
          50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1',
          400: '#A8A29E', 500: '#78716C', 600: '#57534E', 700: '#44403C',
          800: '#292524', 900: '#1C1917',
        },
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(28,25,23,0.05), 0 1px 3px rgba(28,25,23,0.06)',
        drawer: '-8px 0 24px rgba(28,25,23,0.08)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
