/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0b0e14',
          surface: '#121722',
          surface2: '#1b2234',
          border: '#232d42',
          accent: '#f0b90b', // Binance Gold
          blue: '#1652f0',   // Coinbase Blue
          green: '#0ecb81',  // Bullish Green
          red: '#f6465d',    // Bearish Red
        }
      }
    },
  },
  plugins: [],
}
