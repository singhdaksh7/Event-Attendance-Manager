import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        indigo:  { DEFAULT: '#6366f1', light: '#818cf8' },
        teal:    { DEFAULT: '#2dd4bf', light: '#5eead4' },
        surface: '#080812',
        card:    '#0c0c1a',
        raised:  '#10101f',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'glow':    'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
