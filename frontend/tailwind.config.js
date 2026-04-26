/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        navy: {
          950: '#050b18',
          900: '#0B1120',
          850: '#0e1628',
          800: '#111d35',
          700: '#162040',
          600: '#1d2d54',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.04)',
          light: 'rgba(255,255,255,0.08)',
          medium: 'rgba(255,255,255,0.12)',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(239,68,68,0.25), 0 0 60px rgba(239,68,68,0.1)',
        'glow-orange': '0 0 20px rgba(249,115,22,0.25), 0 0 60px rgba(249,115,22,0.1)',
        'glow-yellow': '0 0 20px rgba(234,179,8,0.2), 0 0 60px rgba(234,179,8,0.08)',
        'glow-green': '0 0 20px rgba(34,197,94,0.2), 0 0 60px rgba(34,197,94,0.08)',
        'glow-blue': '0 0 20px rgba(59,130,246,0.25), 0 0 60px rgba(59,130,246,0.1)',
        'glow-sm-red': '0 0 8px rgba(239,68,68,0.4)',
        'glow-sm-blue': '0 0 8px rgba(59,130,246,0.4)',
        'glass': '0 8px 32px rgba(0,0,0,0.4)',
        'glass-sm': '0 4px 16px rgba(0,0,0,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
};
