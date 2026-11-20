/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B2545',
          blue: '#1D63ED',
          sport: '#10B981',
          sky: '#E8F3FF',
          canvas: '#F4F7FA',
          live: '#EF4444',
          gold: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'ios-card': '0 4px 20px -2px rgba(11, 37, 69, 0.06)',
        'ios-nav': '0 -4px 24px rgba(11, 37, 69, 0.08)',
      },
    },
  },
  plugins: [],
}