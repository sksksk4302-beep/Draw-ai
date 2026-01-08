/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Jua', 'sans-serif'],
      },
      colors: {
        blue: {
          50: '#eff6ff', // Very light blue
          400: '#60a5fa', // Main button
          500: '#3b82f6', // Hover
        },
        yellow: {
          400: '#facc15', // Point color (stars, coins)
        }
      },
      boxShadow: {
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
