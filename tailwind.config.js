/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:   '#06060c',
        'bg-1': '#0a0a14',
        'bg-2': '#0f0f1c',
        'bg-3': '#14142a',
        primary: {
          DEFAULT: '#7c83ff',
          light:   '#a5aaff',
          dark:    '#4f46e5',
        },
        secondary: '#c084fc',
        accent:    '#22d3ee',
        success:   '#34d399',
        warning:   '#fbbf24',
        danger:    '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
