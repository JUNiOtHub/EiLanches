/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./screens/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./config/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./*.{tsx,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}