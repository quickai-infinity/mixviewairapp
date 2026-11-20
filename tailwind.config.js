/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B2545',      // Seguridad y autoridad
          blue: '#1D63ED',      // Acción principal estilo iOS
          sport: '#10B981',     // Deporte y energía positiva
          sky: '#E8F3FF',       // Relax / acento suave
          canvas: '#F4F7FA',    // Fondo limpio iOS (anti-fatiga)
          live: '#EF4444',      // Indicador EN DIRECTO
          gold: '#F59E0B',      // Turno aéreo / clip destacado
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'ios-card': '0 4px 20px -2px rgba(11, 37, 69, 0.06)',
        'ios-nav': '0 -4px 24px rgba(11, 37, 69, 0.08)',
      },
    },
  },
  plugins: [],
}