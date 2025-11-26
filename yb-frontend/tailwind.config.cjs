/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Yecny brand palette (from logo)
        "yecny-primary": "#0E9BA7",
        "yecny-primary-dark": "#0A747C",
        "yecny-primary-soft": "#D8F3F5",

        "yecny-charcoal": "#1A1A1A",
        "yecny-slate": "#475569",

        "yecny-bg": "#F5F6F7",
      },
    },
  },
  plugins: [],
};
